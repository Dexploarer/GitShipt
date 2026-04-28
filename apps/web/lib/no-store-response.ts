import "server-only";

import { NextResponse } from "next/server";

const PRIVATE_NO_STORE = "private, no-store, max-age=0, must-revalidate";
const NO_STORE = "no-store, max-age=0, must-revalidate";

export function privateNoStoreHeaders(headers?: HeadersInit): Headers {
  return noStoreHeaders(headers, { private: true });
}

export function noStoreHeaders(
  headers?: HeadersInit,
  options: { private?: boolean } = {},
): Headers {
  const nextHeaders = new Headers(headers);
  nextHeaders.set("Cache-Control", options.private ? PRIVATE_NO_STORE : NO_STORE);
  nextHeaders.set("Pragma", "no-cache");
  nextHeaders.set("Expires", "0");
  return nextHeaders;
}

export function privateNoStoreJson(
  body: unknown,
  init: ResponseInit = {},
): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: privateNoStoreHeaders(init.headers),
  });
}

export function noStoreJson(
  body: unknown,
  init: ResponseInit = {},
): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: noStoreHeaders(init.headers),
  });
}
