from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command
from typing import TypedDict

# -----------------------
# 1. Definir estado
# -----------------------
class MyState(TypedDict):
    user_input: str
    confirmed: str


# -----------------------
# 2. Nodos
# -----------------------
def start_node(state: MyState):
    print("➡️ start_node ejecutado")
    return state


def ask_user_node(state: MyState):
    # Este nodo nunca se ejecuta en la primera pasada
    print("🛑 ask_user_node ejecutado (después del resume)")
    
    return {
        **state,
        "confirmed": state.get("user_input")
    }


def end_node(state: MyState):
    print("✅ end_node ejecutado")
    return state


# -----------------------
# 3. Construcción del grafo
# -----------------------
builder = StateGraph(MyState)

builder.add_node("start", start_node)
builder.add_node("ask_user", ask_user_node)
builder.add_node("end", end_node)

builder.set_entry_point("start")

builder.add_edge("start", "ask_user")
builder.add_edge("ask_user", "end")

# 👇 IMPORTANTE
memory = MemorySaver()

graph = builder.compile(
    checkpointer=memory,
    interrupt_before=["ask_user"]  # se frena antes de este nodo
)


# -----------------------
# 4. Config (thread_id)
# -----------------------
config = {
    "configurable": {
        "thread_id": "demo-thread"
    }
}


# -----------------------
# 5. PRIMER INVOKE
# -----------------------
print("\n--- PRIMER INVOKE ---")

graph.invoke(
    {"user_input": "quiero comprar zapatillas"},
    config=config
)

# En este punto:
# - start_node se ejecutó
# - ask_user_node NO se ejecutó
# - el estado quedó guardado


# -----------------------
# 6. SEGUNDO INVOKE (RESUME)
# -----------------------
print("\n--- SEGUNDO INVOKE (RESUME) ---")

graph.invoke(
    Command(update={"user_input": "quiero comprar zapatillas"}),
    config=config
)

# Ahora:
# - retoma en ask_user_node
# - luego sigue a end_node