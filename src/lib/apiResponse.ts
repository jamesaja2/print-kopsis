import { NextResponse } from "next/server";

export function ok(data: unknown = {}, message = "OK", status = 200) {
    return NextResponse.json({ success: true, data, message }, { status });
}

export function fail(message: string, status = 400, data: unknown = {}) {
    return NextResponse.json({ success: false, data, message }, { status });
}
