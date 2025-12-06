import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface JobSuggestionsProps {
  currentJobTitles: string[];
  onAddJobTitle: (title: string) => void;
}

export const JobSuggestions = ({ currentJobTitles, onAddJobTitle }: JobSuggestionsProps) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastJobTitle, setLastJobTitle] = useState("");

  const generateSuggestions = async () => {
    if (currentJobTitles.length === 0) {
      toast.error("Digite pelo menos um cargo para gerar sugestões");
      return;
    }

    const jobToSuggest = currentJobTitles[currentJobTitles.length - 1];
    
    if (jobToSuggest === lastJobTitle && suggestions.length > 0) {
      return; // Already have suggestions for this job
    }

    setIsLoading(true);
    setSuggestions([]);

    try {
      const { data, error } = await supabase.functions.invoke("suggest-jobs", {
        body: { jobTitle: jobToSuggest },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Filter out suggestions that are already in the list
      const newSuggestions = (data.suggestions || []).filter(
        (s: string) => !currentJobTitles.some(
          (existing) => existing.toLowerCase() === s.toLowerCase()
        )
      );

      setSuggestions(newSuggestions);
      setLastJobTitle(jobToSuggest);

      if (newSuggestions.length === 0) {
        toast.info("Nenhuma sugestão adicional encontrada");
      }
    } catch (error) {
      console.error("Error generating suggestions:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao gerar sugestões");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSuggestion = (suggestion: string) => {
    onAddJobTitle(suggestion);
    setSuggestions((prev) => prev.filter((s) => s !== suggestion));
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={generateSuggestions}
        disabled={isLoading || currentJobTitles.length === 0}
        className="gap-2 text-xs"
      >
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
        Sugerir cargos similares
      </Button>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => (
            <Badge
              key={suggestion}
              variant="outline"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs py-1 gap-1"
              onClick={() => handleAddSuggestion(suggestion)}
            >
              <Plus className="h-3 w-3" />
              {suggestion}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
