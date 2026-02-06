import { NextRequest } from "next/server";

import { forwardJson, requireAuth } from "../_lib/proxy";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  return forwardJson(request, `/get_route${query ? `?${query}` : ""}`);
}
