import { useParams } from "@tanstack/react-router";

/** Endereço (slug) da clínica atual, ex.: "clinica-sol" em /clinica-sol/agenda. */
export function useClinica() {
  return useParams({ from: "/_authenticated/$clinica" }).clinica;
}
