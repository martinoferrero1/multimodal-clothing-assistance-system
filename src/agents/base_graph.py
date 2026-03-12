from abc import ABC, abstractmethod
from typing import Dict
from langgraph.graph.state import CompiledStateGraph


class BaseGraph(ABC):

    _compiled_graphs: Dict[str, CompiledStateGraph] = {}

    def get_graph(self) -> CompiledStateGraph:
        graph_key = self._get_graph_key()
        if graph_key not in BaseGraph._compiled_graphs:
            BaseGraph._compiled_graphs[graph_key] = self._build_graph()
        return BaseGraph._compiled_graphs[graph_key]
    
    @abstractmethod
    def _build_graph(self) -> CompiledStateGraph:
        pass

    @abstractmethod
    def _get_graph_key(self) -> str:
        pass