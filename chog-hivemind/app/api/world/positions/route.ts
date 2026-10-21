import { positions } from "@/world/data";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await positions());
}
