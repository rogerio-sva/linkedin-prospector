import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export interface SearchRun {
  id: string;
  run_id: string;
  dataset_id: string | null;
  status: string;
  filters: Json | null;
  fetch_count: number | null;
  output_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export const useSearchRuns = () => {
  const [searchRuns, setSearchRuns] = useState<SearchRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRun, setActiveRun] = useState<SearchRun | null>(null);

  const fetchSearchRuns = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("search_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error fetching search runs:", error);
        return;
      }

      setSearchRuns(data || []);

      // Check for active (RUNNING) or timed-out runs
      const active = data?.find(
        (run) => run.status === "RUNNING" || run.status === "READY"
      );
      const timedOut = data?.find((run) => run.status === "TIMED-OUT");

      if (active) {
        setActiveRun(active);
      } else if (timedOut) {
        setActiveRun(timedOut);
      } else {
        setActiveRun(null);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSearchRuns();
  }, [fetchSearchRuns]);

  const clearActiveRun = useCallback(() => {
    setActiveRun(null);
  }, []);

  const deleteRun = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from("search_runs")
        .delete()
        .eq("id", id);

      if (error) {
        throw error;
      }

      setSearchRuns((prev) => prev.filter((run) => run.id !== id));
      toast.success("Busca removida do histórico");
    } catch (err) {
      console.error("Error deleting search run:", err);
      toast.error("Erro ao remover busca");
    }
  }, []);

  const refreshRuns = useCallback(() => {
    fetchSearchRuns();
  }, [fetchSearchRuns]);

  return {
    searchRuns,
    isLoading,
    activeRun,
    clearActiveRun,
    deleteRun,
    refreshRuns,
  };
};
