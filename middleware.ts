import type {NextRequest} from 'next/server'
import {NextResponse} from 'next/server'

export function middleware(request: NextRequest) {
    const {origin, pathname} = request.nextUrl;

    if (pathname.startsWith('/_next'))
        return;

    if (/\.(gif|jpg|jpeg|tiff|png|ico|xcf|svg|mp4|m4v|mkv|webm|avif|pdf|txt)$/i.test(pathname)) {
        let rewriteUrl = new URL(process.env.NEXT_PUBLIC_API_FS_RAW + pathname, origin);
        // console.log('rewrite', `${rewriteUrl}`, pathname);
        return NextResponse.rewrite(rewriteUrl)
    }
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", request.nextUrl.pathname);
    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
}

