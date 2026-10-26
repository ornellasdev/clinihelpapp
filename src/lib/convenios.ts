export type TipoConvenio = "convenio" | "particular" | "liminar";

export const TIPOS_CONVENIO: { value: TipoConvenio; label: string }[] = [
  { value: "convenio", label: "Convênio" },
  { value: "particular", label: "Particular" },
  { value: "liminar", label: "Liminar" },
];

export const rotuloTipoConvenio = (t: string) => TIPOS_CONVENIO.find((x) => x.value === t)?.label ?? t;
