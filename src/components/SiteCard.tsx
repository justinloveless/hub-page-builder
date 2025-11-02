import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Settings, Users } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Site = Tables<"sites">;

interface SiteCardProps {
  site: Site;
}

const SiteCard = ({ site }: SiteCardProps) => {
  const navigate = useNavigate();

  return (
    <Card className="group hover:shadow-[var(--shadow-card-hover)] transition-[box-shadow] duration-300 border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
              {site.name}
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              {site.repo_full_name}
            </p>
          </div>
          <Badge variant="secondary" className="ml-2">
            {site.default_branch}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>Members</span>
          </div>
          <div className="text-xs">
            Updated {new Date(site.updated_at).toLocaleDateString()}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 pt-3 border-t border-border">
        <Button 
          variant="outline" 
          className="flex-1" 
          size="sm"
          onClick={() => navigate(`/manage/${site.id}`)}
        >
          <Settings className="mr-2 h-4 w-4" />
          Manage
        </Button>
        <Button variant="outline" size="sm">
          <ExternalLink className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SiteCard;
