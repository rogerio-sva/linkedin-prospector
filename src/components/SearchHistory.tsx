import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Users, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchQuery } from "@/types/contact";

interface SearchHistoryProps {
  searches: SearchQuery[];
  onLoadSearch: (search: SearchQuery) => void;
}

export const SearchHistory = ({
  searches,
  onLoadSearch,
}: SearchHistoryProps) => {
  if (searches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
        <Clock className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhuma busca realizada ainda
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2 pr-4">
        {searches.map((search, index) => (
          <div
            key={search.id}
            className="group relative p-3 rounded-lg border transition-all cursor-pointer animate-slide-in bg-card border-border hover:border-primary/30 hover:bg-muted/50"
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => onLoadSearch(search)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground truncate">
                  {search.query}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {search.resultsCount} contatos
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(search.createdAt, "dd MMM", { locale: ptBR })}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
