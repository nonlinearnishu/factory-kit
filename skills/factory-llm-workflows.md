---
name: factory-llm-workflows
description: LLM workflow conventions distilled from production agent/RAG work. Covers LangGraph TypedDict state schemas, node factory closures, conditional edge routing, structured output via JSON schema, prompt fallback patterns with optional PromptHub override, hybrid search with confidence gating + fallback supplement, SSE streaming with event dispatch, hexagonal ports/adapters when scale justifies. Read when building any LLM-driven workflow with state, tool calls, or streaming UX.
---

# Factory LLM workflows

## State — TypedDict, not Pydantic

```py
from typing import TypedDict
from typing_extensions import NotRequired

class ChatState(TypedDict, total=False):
    """Documented fields. total=False makes everything optional."""
    user_query: str
    intent: NotRequired[str]
    rewritten_query: NotRequired[str]
    retrieved_chunks: NotRequired[list[RetrievedChunk]]
    response: NotRequired[str]
    rag_fallback_attempted: NotRequired[bool]  # one-attempt loop guards
```

Why TypedDict over Pydantic / dataclass: LangGraph merges state shallowly between nodes; TypedDict matches that semantics. Nested TypedDicts (`RetrievedChunk`, `EvidenceChunk`, `ClaimVerdict`) for complex types.

## Graph composition — node factory closures

Nodes are functions returned by factories that inject dependencies. Separates node logic from graph wiring.

```py
def create_router_node(
    llm: LLM,
    prompt_template: str,
) -> Callable[[ChatState], Awaitable[ChatState]]:
    async def router_node(state: ChatState) -> ChatState:
        result = await llm.acomplete(
            prompt_template.format(query=state["user_query"]),
            output_schema=ROUTER_OUTPUT_SCHEMA,
        )
        return {"intent": result["intent"], "rewritten_query": result["rewritten_query"]}
    return router_node

# graph.py assembles:
graph.add_node("router", create_router_node(llm, ROUTER_PROMPT))
```

## Conditional edges — named router functions

Routing logic lives in named functions, not nested conditionals in `add_conditional_edges`:

```py
def _should_continue_after_router(state: ChatState) -> str:
    if state.get("intent") == "general":
        return "general_node"
    if not state.get("rewritten_query"):
        return "END"
    return "rag_node"

graph.add_conditional_edges("router", _should_continue_after_router, {
    "general_node": "general_node",
    "rag_node": "rag_node",
    "END": END,
})
```

Testable, readable, no nesting.

## Structured output — JSON schema dict

For nodes that produce structured output (intent classification, claim extraction):

```py
ROUTER_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "intent": {"type": "string", "enum": ["general", "rag", "claim_verify"]},
        "rewritten_query": {"type": "string"},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    },
    "required": ["intent", "confidence"],
}
```

This schema doubles as (a) LLM instruction (tool definition) and (b) validation contract (validates the `tool_calls` result). One source of truth — don't define two.

## Prompt patterns — local fallback + optional PromptHub

```py
ROUTER_PROMPT = """You are an intent classifier...
Examples:
- "what is X?" -> general
- "how does our team handle X?" -> rag
Output a JSON object matching the schema."""

async def get_router_prompt(prompt_hub: PromptHub | None) -> str:
    if prompt_hub:
        try:
            return await prompt_hub.get("router")
        except Exception:
            pass
    return ROUTER_PROMPT
```

PromptHub override is **optional**. Local prompt string is the source of truth so offline dev works.

## RAG — hybrid search, confidence threshold, fallback supplement

```py
async def rag_node(state: ChatState) -> ChatState:
    chunks = await vector_store.hybrid_search(
        query=state["rewritten_query"],
        alpha=0.5,                          # BM25 vs semantic blend
        top_k=10 * TOP_K_MULTIPLIER,        # over-fetch for reranker
    )
    if reranker is not None:
        chunks = await reranker.rerank(state["rewritten_query"], chunks, top_k=10)

    # Confidence gating
    confident_chunks = [c for c in chunks if c.score >= CONFIDENCE_THRESHOLD]  # default 0.3
    if not confident_chunks and not state.get("rag_fallback_attempted"):
        return {"retrieved_chunks": [], "needs_fallback": True}

    return {"retrieved_chunks": confident_chunks}
```

**Fallback supplement RAG** runs at most once (`rag_fallback_attempted: True` flag prevents loops). If first pass returns nothing useful, try a broader search; never retry past one attempt.

## Streaming — SSE with event dispatch

Backend (FastAPI) emits typed events:

```py
@router.get("/chat/stream")
async def chat_stream(request: Request):
    async def event_generator():
        yield {"event": "status", "data": "starting"}
        async for chunk in workflow.astream(state):
            if "token" in chunk: yield {"event": "token", "data": chunk["token"]}
            if "intent" in chunk: yield {"event": "intent", "data": chunk["intent"]}
            if "sources" in chunk: yield {"event": "sources", "data": json.dumps(chunk["sources"])}
        yield {"event": "done", "data": ""}
    return EventSourceResponse(event_generator())
```

Frontend (TypeScript) registers callbacks per event name:

```ts
const eventHandlers: Record<string, (data: string) => void> = {
  status: (data) => setStatus(data),
  intent: (data) => setIntent(data),
  sources: (data) => setSources(JSON.parse(data)),
  token: (data) => appendToken(data),
  done: () => setDone(true),
  error: (data) => setError(data),
};
```

**Names must match exactly across backend and frontend.** Use a shared constant module if the polyglot setup allows it (TypeScript codegen from Python is overkill; a hand-maintained const file is fine).

## Hexagonal ports/adapters — when scale justifies

For projects with swappable infra (vector store, storage, chunker, reranker), define `Protocol` interfaces in `domain/ports/`, implementations in `adapters/`. Switch via env at `dependencies.py`:

```py
def get_storage() -> StoragePort:
    if settings.s3_bucket_name:
        return S3Storage(settings.s3_bucket_name)
    return FilesystemStorage(settings.local_storage_path)
```

Don't reach for ports/adapters from day one — only when you actually need to swap the implementation. Optional ports (`Port | None`) work for things like reranker where the caller checks before use.

## Multi-tenancy — project-scoped vector store tenants

Vector store operations take a `project_id` (or `tenant_id`); adapter ensures per-tenant isolation (Weaviate tenant API or equivalent). Never share an index across tenants — RBAC at the app layer is not enough.

```py
async def search(self, query: str, project_id: str, top_k: int) -> list[Chunk]:
    return await self._client.tenant(project_id).query(/* ... */)
```

## Token-based chunking with overlap

For long-form docs (markdown, PDFs):

- `tiktoken` for token counting
- Sliding window with `max_token_limit` (e.g. 512) + `token_overlap` (e.g. 50)
- **Hierarchical markdown chunker** preserves header tree as breadcrumbs; tables and code blocks are atomic (don't split mid-table)

## Lazy DI with `@lru_cache`

Heavy deps (vector store clients, LLM clients, reranker models) imported inside functions to avoid loading during test imports:

```py
@lru_cache
def get_vector_store() -> VectorStorePort:
    from .adapters.vectorstore.weaviate import WeaviateAdapter
    return WeaviateAdapter(...)
```

## What NOT to do

- **Don't use Pydantic state for LangGraph workflows.** Use TypedDict — LangGraph's merge semantics are shallow.
- **Don't put routing logic inline in `add_conditional_edges`.** Name the router functions (`_should_continue_after_X`); they're testable and readable.
- **Don't run RAG retries past one fallback attempt.** Set the `*_attempted` flag in state; check it before recursing.
- **Don't use PromptHub as the source of truth.** Local prompt strings are the fallback that makes offline dev work.
- **Don't share vector store indexes across tenants.** Use per-tenant indexes — RBAC at app layer is not enough.
- **Don't define two schemas (LLM instruction + validation).** One JSON schema dict drives both.
- **Don't reach for ports/adapters from day one.** Only when you actually swap implementations.

## Pitfalls referenced

- **Chat is append-only but claims are versioned** in our reference repo. If message editing becomes a feature, versioning is expensive to retrofit. Version anything that might need editing later.
- **Triple-fallback auth surface** (Clerk → extension token → header) means three paths to test. Pick one auth provider per surface.
- **No explicit A/B test infra for chunker / alpha tuning.** Env-driven config is good enough until you have comparison data.

## Source patterns

All from cothon — the strongest single-source domain in the kit. Reference repo for any new LLM/agent work.
