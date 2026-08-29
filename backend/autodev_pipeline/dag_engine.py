"""
AutoDev Robust Pipeline Algorithm - DAG Dependency Engine & Cycle Resolution.

File: src/autodev_pipeline/dag_engine.py
Milestone: M2 (DAG Engine, Kahn's Algorithm, Tarjan's SCC & Cycle Resolution)
"""

from __future__ import annotations

import collections
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from autodev_pipeline.models import (
    ComponentStateRecord,
    ComponentStatus,
    CycleResolutionPolicy,
)


@dataclass(frozen=True)
class DAGValidationResult:
    """
    Comprehensive validation report for a component dependency graph.
    """
    is_valid: bool
    has_cycles: bool
    cycles: List[List[str]] = field(default_factory=list)
    missing_dependencies: Dict[str, List[str]] = field(default_factory=dict)
    self_dependencies: List[str] = field(default_factory=list)
    orphan_nodes: List[str] = field(default_factory=list)
    error_messages: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class TopologicalPlan:
    """
    Execution plan produced by Kahn's algorithm with layer and depth metrics.
    """
    linear_order: List[str]
    parallel_layers: List[List[str]]
    critical_path_lengths: Dict[str, int]
    in_degrees: Dict[str, int]


@dataclass(frozen=True)
class CycleResolutionResult:
    """
    Outcome of executing a cycle resolution policy.
    """
    policy: CycleResolutionPolicy
    resolved_acyclic: bool
    stalled_components: List[str] = field(default_factory=list)
    broken_edges: List[Tuple[str, str]] = field(default_factory=list)
    injected_stubs: Dict[str, List[str]] = field(default_factory=dict)
    diagnostic_message: str = ""


class PipelineDAG:
    """
    Deterministic Directed Acyclic Graph engine for component dependency resolution,
    Kahn topological sorting, Tarjan SCC cycle extraction, and safe stall policies.
    """

    def __init__(self) -> None:
        # Internal adjacency structures:
        # _downstream[u] = {v1, v2} means u -> v (v depends on u)
        self._downstream: Dict[str, Set[str]] = collections.defaultdict(set)
        # _upstream[v] = {u1, u2} means u -> v (v depends on u)
        self._upstream: Dict[str, Set[str]] = collections.defaultdict(set)
        # Registered component state records mapping component_id -> ComponentStateRecord
        self._nodes: Dict[str, ComponentStateRecord] = {}

    @property
    def nodes(self) -> Dict[str, ComponentStateRecord]:
        """Returns the dictionary of registered component state records."""
        return self._nodes

    def get_component(self, component_id: str) -> Optional[ComponentStateRecord]:
        """Retrieves a component record by its ID."""
        return self._nodes.get(component_id)

    def get_node(self, component_id: str) -> Optional[ComponentStateRecord]:
        """Alias for get_component."""
        return self.get_component(component_id)

    def add_component(self, component: ComponentStateRecord) -> None:
        """Adds a component node and registers its declared dependencies."""
        cid = component.component_id
        self._nodes[cid] = component
        if cid not in self._downstream:
            self._downstream[cid] = set()
        if cid not in self._upstream:
            self._upstream[cid] = set()

        for dep_id in component.dependencies:
            self.add_dependency(component_id=cid, depends_on_id=dep_id)

    def add_node(self, component: ComponentStateRecord) -> None:
        """Alias for add_component to support alternative graph builder signatures."""
        self.add_component(component)

    def add_dependency(self, component_id: str, depends_on_id: str) -> None:
        """
        Adds a directed dependency edge: depends_on_id -> component_id
        (depends_on_id is a prerequisite for component_id).
        """
        self._upstream[component_id].add(depends_on_id)
        self._downstream[depends_on_id].add(component_id)
        if component_id in self._nodes:
            if depends_on_id not in self._nodes[component_id].dependencies:
                self._nodes[component_id].dependencies.append(depends_on_id)

    def remove_dependency(self, component_id: str, depends_on_id: str) -> None:
        """Removes a directed dependency edge."""
        self._upstream[component_id].discard(depends_on_id)
        self._downstream[depends_on_id].discard(component_id)
        if component_id in self._nodes:
            if depends_on_id in self._nodes[component_id].dependencies:
                self._nodes[component_id].dependencies.remove(depends_on_id)

    def compute_in_degrees(self) -> Dict[str, int]:
        """
        Computes the in-degree for all registered components.
        In-degree is the count of registered prerequisite components.
        """
        in_degrees: Dict[str, int] = {}
        for cid in self._nodes:
            in_degrees[cid] = len([u for u in self._upstream.get(cid, set()) if u in self._nodes])
        return in_degrees

    def detect_cycles_tarjan(self) -> List[List[str]]:
        """
        Executes Tarjan's Strongly Connected Components algorithm.
        Returns a list of cycle paths for all SCCs with |SCC| > 1 or self-loops.
        Time Complexity: O(|V| + |E|).
        """
        index = 0
        indices: Dict[str, int] = {}
        lowlinks: Dict[str, int] = {}
        stack: List[str] = []
        on_stack: Set[str] = set()
        sccs: List[List[str]] = []

        def strongconnect(node: str) -> None:
            nonlocal index
            indices[node] = index
            lowlinks[node] = index
            index += 1
            stack.append(node)
            on_stack.add(node)

            # Consider successors in forward graph (downstream)
            for successor in sorted(self._downstream.get(node, set())):
                # Only explore known nodes
                if successor not in self._nodes:
                    continue
                if successor not in indices:
                    strongconnect(successor)
                    lowlinks[node] = min(lowlinks[node], lowlinks[successor])
                elif successor in on_stack:
                    lowlinks[node] = min(lowlinks[node], indices[successor])

            if lowlinks[node] == indices[node]:
                scc: List[str] = []
                while True:
                    w = stack.pop()
                    on_stack.remove(w)
                    scc.append(w)
                    if w == node:
                        break

                # An SCC is a cycle if |SCC| > 1 or if a single node has a self-edge
                if len(scc) > 1:
                    sccs.append(scc)
                elif len(scc) == 1 and (node in self._downstream.get(node, set()) or node in self._nodes[node].dependencies):
                    sccs.append(scc)

        for node_id in sorted(self._nodes.keys()):
            if node_id not in indices:
                strongconnect(node_id)

        # Extract structured closed cycle paths
        cycle_paths: List[List[str]] = []
        for scc in sccs:
            path = self._extract_cycle_path_from_scc(scc)
            cycle_paths.append(path)

        return cycle_paths

    def detect_cycles(self) -> List[List[str]]:
        """Alias for detect_cycles_tarjan."""
        return self.detect_cycles_tarjan()

    def _extract_cycle_path_from_scc(self, scc: List[str]) -> List[str]:
        """Extracts an exact closed cycle traversal path from nodes in an SCC."""
        scc_set = set(scc)
        if len(scc) == 1:
            return [scc[0], scc[0]]

        # DFS with path tracking to find a simple directed closed loop
        visited: Set[str] = set()
        path: List[str] = []

        def dfs_find_cycle(curr: str) -> Optional[List[str]]:
            visited.add(curr)
            path.append(curr)
            for nxt in sorted(self._downstream.get(curr, set())):
                if nxt in scc_set:
                    if nxt in path:
                        cycle_start_idx = path.index(nxt)
                        return path[cycle_start_idx:] + [nxt]
                    elif nxt not in visited:
                        res = dfs_find_cycle(nxt)
                        if res is not None:
                            return res
            path.pop()
            return None

        for node in scc:
            if node not in visited:
                res = dfs_find_cycle(node)
                if res is not None:
                    return res

        return scc + [scc[0]]

    def validate_graph(self) -> DAGValidationResult:
        """
        Validates graph referential integrity, self-dependencies, and acyclicity.
        Returns a detailed DAGValidationResult.
        """
        missing_deps: Dict[str, List[str]] = {}
        self_deps: List[str] = []
        errors: List[str] = []

        all_node_ids = set(self._nodes.keys())

        # 1. Check self-dependencies and missing references
        for cid, node in sorted(self._nodes.items()):
            declared_deps = list(node.dependencies)
            for dep in declared_deps:
                if dep == cid:
                    if cid not in self_deps:
                        self_deps.append(cid)
                    errors.append(f"Component '{cid}' has a self-dependency.")
                elif dep not in all_node_ids:
                    if cid not in missing_deps:
                        missing_deps[cid] = []
                    if dep not in missing_deps[cid]:
                        missing_deps[cid].append(dep)
                    errors.append(f"Component '{cid}' depends on non-existent component '{dep}'.")

        # 2. Check cycles using Tarjan's SCC
        cycles = self.detect_cycles_tarjan()
        has_cycles = len(cycles) > 0
        if has_cycles:
            for cycle in cycles:
                cycle_str = " -> ".join(cycle)
                errors.append(f"Circular dependency detected: {cycle_str}")

        # 3. Check orphan nodes (nodes with missing dependencies)
        orphans = sorted(list(missing_deps.keys()))

        is_valid = (len(self_deps) == 0 and len(missing_deps) == 0 and not has_cycles)

        return DAGValidationResult(
            is_valid=is_valid,
            has_cycles=has_cycles,
            cycles=cycles,
            missing_dependencies=missing_deps,
            self_dependencies=self_deps,
            orphan_nodes=orphans,
            error_messages=errors,
        )

    def compute_topological_plan(self) -> TopologicalPlan:
        """
        Executes Kahn's algorithm to compute linear order, parallel execution layers,
        and critical path lengths.
        Raises ValueError if the graph contains cycles or unresolved dependencies.
        """
        in_degrees = self.compute_in_degrees()

        # Layer 0: all nodes with in_degree == 0
        current_layer = [cid for cid, deg in in_degrees.items() if deg == 0]
        # Sort current layer deterministically by (priority_order, component_id)
        current_layer.sort(key=lambda x: (self._nodes[x].priority_order, x))

        parallel_layers: List[List[str]] = []
        linear_order: List[str] = []
        temp_in_degrees = dict(in_degrees)

        while current_layer:
            parallel_layers.append(list(current_layer))
            next_layer: List[str] = []

            for u in current_layer:
                linear_order.append(u)
                for v in sorted(self._downstream.get(u, set())):
                    if v in temp_in_degrees:
                        temp_in_degrees[v] -= 1
                        if temp_in_degrees[v] == 0:
                            next_layer.append(v)

            next_layer.sort(key=lambda x: (self._nodes[x].priority_order, x))
            current_layer = next_layer

        if len(linear_order) < len(self._nodes):
            unprocessed = sorted(list(set(self._nodes.keys()) - set(linear_order)))
            raise ValueError(
                f"Graph contains cycles or unresolved dependencies. Unprocessed nodes: {unprocessed}"
            )

        # Compute critical path length (longest path from node to any sink)
        critical_paths = self._compute_critical_paths(linear_order)

        return TopologicalPlan(
            linear_order=linear_order,
            parallel_layers=parallel_layers,
            critical_path_lengths=critical_paths,
            in_degrees=in_degrees,
        )

    def _compute_critical_paths(self, topological_order: List[str]) -> Dict[str, int]:
        """Computes critical path distance to leaf for each node via reverse topological DP."""
        path_lengths: Dict[str, int] = {cid: 1 for cid in self._nodes}
        for u in reversed(topological_order):
            for v in self._downstream.get(u, set()):
                if v in path_lengths:
                    path_lengths[u] = max(path_lengths[u], 1 + path_lengths[v])
        return path_lengths

    def get_ready_components(self, completed_ids: Optional[Set[str]] = None) -> List[str]:
        """
        Returns all component IDs that:
        1. Are currently in CREATED or PENDING_DEPS status.
        2. Have all upstream dependencies present in completed_ids.
        Sorted by priority_order (ascending: 0 is highest priority), then created_at, then ID.
        """
        if completed_ids is None:
            completed_ids = {
                cid for cid, node in self._nodes.items() if node.status == ComponentStatus.COMPLETED
            }

        ready: List[str] = []
        for cid, node in self._nodes.items():
            if node.status in (ComponentStatus.CREATED, ComponentStatus.PENDING_DEPS):
                upstream = self._upstream.get(cid, set())
                # Only check prerequisites that are registered in _nodes
                valid_upstream = {u for u in upstream if u in self._nodes}
                if valid_upstream.issubset(completed_ids):
                    ready.append(cid)

        ready.sort(key=lambda x: (self._nodes[x].priority_order, self._nodes[x].created_at, x))
        return ready

    def get_downstream_dependents(self, component_id: str, transitive: bool = True) -> Set[str]:
        """
        Returns all direct (or transitive) downstream dependent component IDs.
        Used for cascade stalling when an upstream component fails or is quarantined.
        """
        if not transitive:
            return set(self._downstream.get(component_id, set())) & set(self._nodes.keys())

        visited: Set[str] = set()
        queue = collections.deque(self._downstream.get(component_id, set()))
        while queue:
            curr = queue.popleft()
            if curr not in visited and curr in self._nodes:
                visited.add(curr)
                for nxt in self._downstream.get(curr, set()):
                    if nxt not in visited and nxt in self._nodes:
                        queue.append(nxt)
        return visited

    def get_dependents(self, component_id: str) -> List[str]:
        """
        Returns direct downstream dependent components as a sorted list.
        Implements interface contract for ConcurrencyController.
        """
        return sorted(list(self.get_downstream_dependents(component_id, transitive=False)))

    def get_upstream_dependencies(self, component_id: str, transitive: bool = True) -> Set[str]:
        """Returns all direct (or transitive) upstream prerequisite component IDs."""
        if not transitive:
            return set(self._upstream.get(component_id, set())) & set(self._nodes.keys())

        visited: Set[str] = set()
        queue = collections.deque(self._upstream.get(component_id, set()))
        while queue:
            curr = queue.popleft()
            if curr not in visited and curr in self._nodes:
                visited.add(curr)
                for prq in self._upstream.get(curr, set()):
                    if prq not in visited and prq in self._nodes:
                        queue.append(prq)
        return visited

    def resolve_cycles(self, policy: CycleResolutionPolicy) -> CycleResolutionResult:
        """
        Applies deterministic cycle resolution policy.
        """
        validation = self.validate_graph()
        if not validation.has_cycles:
            return CycleResolutionResult(
                policy=policy,
                resolved_acyclic=True,
                diagnostic_message="Graph is already acyclic.",
            )

        cycle_nodes_set: Set[str] = set()
        for cycle in validation.cycles:
            cycle_nodes_set.update(cycle)

        if policy == CycleResolutionPolicy.ABORT:
            return CycleResolutionResult(
                policy=policy,
                resolved_acyclic=False,
                stalled_components=sorted(list(cycle_nodes_set)),
                diagnostic_message=f"Aborting pipeline: {len(validation.cycles)} cycle(s) detected.",
            )

        elif policy == CycleResolutionPolicy.SAFE_STALL:
            # Mark all cycle nodes and their downstream dependents as STALLED
            stalled_set = set(cycle_nodes_set)
            for cid in list(cycle_nodes_set):
                stalled_set.update(self.get_downstream_dependents(cid, transitive=True))

            for cid in stalled_set:
                if cid in self._nodes:
                    node = self._nodes[cid]
                    if node.status in (
                        ComponentStatus.CREATED,
                        ComponentStatus.PENDING_DEPS,
                        ComponentStatus.READY,
                    ):
                        node.status = ComponentStatus.STALLED
                        node.error_log = "Stalled due to circular dependency participation or upstream cycle."

            return CycleResolutionResult(
                policy=policy,
                resolved_acyclic=False,
                stalled_components=sorted(list(stalled_set)),
                diagnostic_message=f"Safe stall activated: {len(stalled_set)} components stalled.",
            )

        elif policy == CycleResolutionPolicy.FEEDBACK_ARC_SET_STUB:
            broken_edges: List[Tuple[str, str]] = []
            stubs: Dict[str, List[str]] = collections.defaultdict(list)

            # Heuristic FAS on detected cycles: iteratively break back edges until acyclic
            max_iterations = 100
            iteration = 0
            while iteration < max_iterations:
                current_validation = self.validate_graph()
                if not current_validation.has_cycles:
                    break

                for cycle in current_validation.cycles:
                    if len(cycle) >= 2:
                        u = cycle[-2]
                        v = cycle[-1] if cycle[-1] != cycle[0] else cycle[0]
                        # Remove edge u -> v
                        self.remove_dependency(component_id=v, depends_on_id=u)
                        broken_edges.append((u, v))
                        stub_id = f"stub::{u}_for_{v}"
                        stubs[v].append(stub_id)
                    elif len(cycle) == 1:
                        # Self cycle
                        u = cycle[0]
                        self.remove_dependency(component_id=u, depends_on_id=u)
                        broken_edges.append((u, u))
                        stub_id = f"stub::{u}_self"
                        stubs[u].append(stub_id)
                iteration += 1

            post_validation = self.validate_graph()
            resolved = not post_validation.has_cycles

            return CycleResolutionResult(
                policy=policy,
                resolved_acyclic=resolved,
                broken_edges=broken_edges,
                injected_stubs=dict(stubs),
                diagnostic_message=f"FAS Stubbing applied: {len(broken_edges)} edge(s) broken, acyclic={resolved}.",
            )

        raise ValueError(f"Unknown cycle resolution policy: {policy}")

    def clone(self) -> PipelineDAG:
        """Creates a deep copy of the DAG and its component states."""
        cloned = PipelineDAG()
        for cid, node in self._nodes.items():
            cloned_node = ComponentStateRecord.from_dict(node.to_dict())
            cloned.add_component(cloned_node)
        return cloned
