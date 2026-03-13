import { getAllRecentPosts } from "@/server/chatDB";
import getCORSHeaders from "@/app/api/cors";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

        const posts = await getAllRecentPosts(limit);

        return Response.json({ posts }, {
            status: 200,
            headers: getCORSHeaders(req),
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return Response.json({ error: message }, {
            status: 500,
            headers: getCORSHeaders(req),
        });
    }
}
