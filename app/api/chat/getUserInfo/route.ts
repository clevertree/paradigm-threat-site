import { getUserById, getUserRecentPosts } from "@/server/chatDB";
import getCORSHeaders from "@/app/api/cors";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userIdParam = searchParams.get('userId');
        if (!userIdParam) {
            return Response.json({ error: "userId is required" }, {
                status: 400,
                headers: getCORSHeaders(req),
            });
        }
        const userId = parseInt(userIdParam, 10);
        if (isNaN(userId)) {
            return Response.json({ error: "Invalid userId" }, {
                status: 400,
                headers: getCORSHeaders(req),
            });
        }

        const user = await getUserById(userId);
        if (!user) {
            return Response.json({ error: "User not found" }, {
                status: 404,
                headers: getCORSHeaders(req),
            });
        }

        const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
        const recentPosts = await getUserRecentPosts(userId, limit);

        return Response.json({
            user,
            recentPosts,
        }, {
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
