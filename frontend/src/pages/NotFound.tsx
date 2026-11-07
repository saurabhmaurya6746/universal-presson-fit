import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { SEO } from "@/components/common/SEO";

export function NotFound() {
  return (
    <>
      <SEO title="Page Not Found" />

      <div className="flex min-h-[70vh] items-center justify-center bg-background px-4 py-20">
        <div className="max-w-md text-center">
          <h1 className="font-display text-8xl font-bold text-foreground">404</h1>
          <h2 className="mt-4 font-display text-3xl font-semibold text-foreground">
            Page not found
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link to="/">Go home</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
