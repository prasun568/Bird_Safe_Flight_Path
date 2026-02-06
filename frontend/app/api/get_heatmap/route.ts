import { NextRequest } from "next/server";

import { forwardJson, requireAuth } from "../_lib/proxy";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  return forwardJson(request, "/get_heatmap");
}
