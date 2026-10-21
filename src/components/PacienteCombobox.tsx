import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { pacientesOpcoesQuery } from "@/lib/queries";
import { idade } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function PacienteCombobox({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const { data: pacientes = [] } = useQuery(pacientesOpcoesQuery);
  const atual = pacientes.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-10 w-full justify-between font-normal">
          <span className={cn("truncate", !atual && "text-muted-foreground")}>{atual?.nome ?? "Selecione o paciente"}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar paciente..." />
          <CommandList>
            <CommandEmpty>Nenhum paciente encontrado.</CommandEmpty>
            <CommandGroup>
              {pacientes.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.nome} ${p.id}`}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{p.nome}</span>
                  <span className="text-xs text-muted-foreground">{idade(p.data_nascimento)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
