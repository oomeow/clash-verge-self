import { useServiceStatusSWR } from "@/services/swr";

export const useService = () => {
  const { data: serviceStatus, mutate: mutateCheckService } =
    useServiceStatusSWR();

  return { serviceStatus, mutateCheckService };
};
