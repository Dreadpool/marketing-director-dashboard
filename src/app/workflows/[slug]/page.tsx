import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getWorkflowBySlug, formatSlugToTitle } from "@/lib/workflows";
import { WorkflowDetail } from "./workflow-detail";

interface WorkflowPageProps {
  params: Promise<{ slug: string }>;
}

export default async function WorkflowPage({ params }: WorkflowPageProps) {
  const { slug } = await params;
  const workflow = getWorkflowBySlug(slug);
  const title = workflow?.title ?? formatSlugToTitle(slug);

  return (
    <div>
      <Link
        href="/workflows"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Workflows
      </Link>

      {workflow?.status === "active" ? (
        <WorkflowDetail workflow={workflow} />
      ) : (
        <>
          <div className="mb-8">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            {workflow && (
              <p className="mt-1 text-sm text-muted-foreground">
                {workflow.description}
              </p>
            )}
          </div>

          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm text-muted-foreground">
                This workflow is under construction. Data integrations and
                visualizations will be added in a future spec.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
