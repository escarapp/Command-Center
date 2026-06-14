"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createNetworkConnection, createNetworkNode, fetchNetworkConnections, fetchNetworkNodes } from "@/lib/digital-twin-api";
import type { NetworkConnectionRow, NetworkNodeRow } from "@/types/phase9";

const NODE_TYPES: NetworkNodeRow["node_type"][] = [
  "utility",
  "wsc",
  "irrigation_district",
  "drainage_district",
  "treatment_plant",
  "reservoir",
  "pipeline_junction",
  "pump_station",
  "storage_facility",
  "water_source",
  "customer",
];

const CONNECTION_TYPES: NetworkConnectionRow["connection_type"][] = [
  "water_source_to_treatment",
  "treatment_to_storage",
  "transmission",
  "distribution",
  "customer_supply",
  "interconnect",
  "drainage",
];

export function DigitalTwinNetworkMapPage() {
  const supabase = useMemo(() => createClient(), []);
  const [nodes, setNodes] = useState<NetworkNodeRow[]>([]);
  const [connections, setConnections] = useState<NetworkConnectionRow[]>([]);
  const [nodeName, setNodeName] = useState("");
  const [nodeType, setNodeType] = useState<NetworkNodeRow["node_type"]>("utility");
  const [nodeCounty, setNodeCounty] = useState("");
  const [connectionType, setConnectionType] = useState<NetworkConnectionRow["connection_type"]>("transmission");
  const [fromNodeId, setFromNodeId] = useState("");
  const [toNodeId, setToNodeId] = useState("");
  const [connectionCapacity, setConnectionCapacity] = useState("0");
  const [connectionLength, setConnectionLength] = useState("0");
  const [status, setStatus] = useState("");

  async function reload() {
    try {
      const [nodeRows, connectionRows] = await Promise.all([
        fetchNetworkNodes(supabase),
        fetchNetworkConnections(supabase),
      ]);
      setNodes(nodeRows);
      setConnections(connectionRows);
      if (!fromNodeId && nodeRows[0]) setFromNodeId(nodeRows[0].id);
      if (!toNodeId && nodeRows[1]) setToNodeId(nodeRows[1].id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Load failed: ${message}. Run supabase/phase9.sql.`);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handleCreateNode() {
    try {
      await createNetworkNode(supabase, {
        node_type: nodeType,
        name: nodeName,
        county: nodeCounty,
      });
      setNodeName("");
      setNodeCounty("");
      await reload();
      setStatus("Network node created.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Create node failed: ${message}`);
    }
  }

  async function handleCreateConnection() {
    try {
      await createNetworkConnection(supabase, {
        connection_type: connectionType,
        from_node_id: fromNodeId,
        to_node_id: toNodeId,
        capacity_mgd: Number(connectionCapacity) || 0,
        length_miles: Number(connectionLength) || 0,
        is_expansion_candidate: true,
      });
      setConnectionCapacity("0");
      setConnectionLength("0");
      await reload();
      setStatus("Network connection created.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Create connection failed: ${message}`);
    }
  }

  const nodeCounts = NODE_TYPES.map((kind) => ({
    kind,
    count: nodes.filter((n) => n.node_type === kind).length,
  }));

  const relationships = connections.slice(0, 200).map((c) => {
    const fromNode = nodes.find((n) => n.id === c.from_node_id)?.name ?? "Unknown";
    const toNode = nodes.find((n) => n.id === c.to_node_id)?.name ?? "Unknown";
    return { ...c, fromNode, toNode };
  });

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Digital Twin · Network Map</h2>
      <p className="mt-1 text-xs text-slate-300">Unified water network across utilities, WSCs, treatment, storage, pipelines, and pump stations.</p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded border border-white/10 bg-slate-900/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Add Network Node</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <select value={nodeType} onChange={(e) => setNodeType(e.target.value as NetworkNodeRow["node_type"])} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
              {NODE_TYPES.map((kind) => (
                <option key={kind} value={kind}>{kind}</option>
              ))}
            </select>
            <input value={nodeName} onChange={(e) => setNodeName(e.target.value)} placeholder="Node name" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
            <input value={nodeCounty} onChange={(e) => setNodeCounty(e.target.value)} placeholder="County (optional)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
            <button type="button" onClick={() => void handleCreateNode()} disabled={!nodeName.trim()} className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50">
              Add Node
            </button>
          </div>
        </div>

        <div className="rounded border border-white/10 bg-slate-900/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Link Infrastructure</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <select value={connectionType} onChange={(e) => setConnectionType(e.target.value as NetworkConnectionRow["connection_type"])} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
              {CONNECTION_TYPES.map((kind) => (
                <option key={kind} value={kind}>{kind}</option>
              ))}
            </select>
            <input value={connectionCapacity} onChange={(e) => setConnectionCapacity(e.target.value)} placeholder="Capacity MGD" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
            <select value={fromNodeId} onChange={(e) => setFromNodeId(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
              <option value="">From node</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            <select value={toNodeId} onChange={(e) => setToNodeId(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
              <option value="">To node</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            <input value={connectionLength} onChange={(e) => setConnectionLength(e.target.value)} placeholder="Length miles" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
            <button type="button" onClick={() => void handleCreateConnection()} disabled={!fromNodeId || !toNodeId || fromNodeId === toNodeId} className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50">
              Add Connection
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {nodeCounts.map((row) => (
          <div key={row.kind} className="rounded border border-white/10 bg-slate-900/30 p-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-300">{row.kind}</p>
            <p className="mt-1 text-xl font-bold text-cyan-200">{row.count}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded border border-white/10 bg-slate-900/30">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/60 text-slate-200">
            <tr>
              <th className="px-2 py-2 text-left">From</th>
              <th className="px-2 py-2 text-left">To</th>
              <th className="px-2 py-2 text-left">Relationship</th>
              <th className="px-2 py-2 text-left">Capacity (MGD)</th>
              <th className="px-2 py-2 text-left">Length (mi)</th>
              <th className="px-2 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {relationships.map((r) => (
              <tr key={r.id} className="border-t border-slate-700 text-slate-200">
                <td className="px-2 py-2 font-semibold text-slate-100">{r.fromNode}</td>
                <td className="px-2 py-2">{r.toNode}</td>
                <td className="px-2 py-2">{r.connection_type}</td>
                <td className="px-2 py-2">{Number(r.capacity_mgd).toFixed(2)}</td>
                <td className="px-2 py-2">{Number(r.length_miles).toFixed(2)}</td>
                <td className="px-2 py-2">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
