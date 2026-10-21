import { useSuspenseQuery } from "@tanstack/react-query";
import { meQuery } from "@/lib/queries";

export function useMe() {
  return useSuspenseQuery(meQuery).data;
}
