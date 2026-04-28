import { createAPIPage } from "fumadocs-openapi/ui";
import { getOpenApiRuntime, matchOpenApiPage } from "@/lib/openapi-source";

export async function ApiOperation({ operation }: { operation: string }) {
  const page = await matchOpenApiPage(operation);

  if (!page) {
    return (
      <div className="surge-warning">
        <strong>OpenAPI mapping missing</strong>
        <div>
          Farming Labs couldn&apos;t resolve <code>{operation}</code> from the local Surge OpenAPI
          document.
        </div>
      </div>
    );
  }

  const { server } = await getOpenApiRuntime();
  const APIPage = createAPIPage(server);

  return (
    <div className="surge-api-operation">
      <APIPage {...page.data.getAPIPageProps()} />
    </div>
  );
}
