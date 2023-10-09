import type {NextRequest} from 'next/server'
import {NextResponse} from 'next/server'
import path from "path";
import fs from "fs";
import mime from "mime";

export function middleware(request: NextRequest) {
    const {origin, pathname} = request.nextUrl;

    if (pathname.startsWith('/_next'))
        return;

    if (/[\/.](gif|jpg|jpeg|tiff|png|ico|xcf|svg|mp4|m4v|mkv|pdf|txt)$/i.test(pathname)) {
        let rewriteUrl = new URL(process.env.NEXT_PUBLIC_ASSET_FILE_PATH + pathname, origin);
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

export function handleFileRequest(req: Request, pathString: string | string[]) {
    if (Array.isArray(pathString))
        pathString = pathString.join('/');
    let filePath = path.resolve(process.cwd(), `${process.env.NEXT_PUBLIC_ASSET_PATH}`, pathString);
    if (fs.existsSync(filePath)) {
        const imageBuffer = fs.readFileSync(filePath)
        return new Response(imageBuffer, {
            status: 200,
            headers: {
                'Content-Type': `${mime.getType(filePath)}`,
                'Cache-Control': 'max-age=31536000',
            }
        })
    }

    console.error("File not found: ", pathString)
    return new Response("File not found", {
        status: 400,
        headers: {
            'Content-Type': `${mime.getType(filePath)}`,
            'Cache-Control': 'max-age=31536000',
        }
    })
}