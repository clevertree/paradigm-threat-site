import { z } from 'zod';
import { getChannelInfo, getOrCreateUserInfo, insertPost, deletePost } from "@/server/chatDB";
import getCORSHeaders from "@/app/api/cors";

export const dynamic = 'force-dynamic';

const RequestDataValidation = z.object({
    content: z.string().min(1).max(1024),
    username: z.string().min(1).max(18),
    mode: z.string().optional(),
    channel: z.string().optional(),
});

export async function POST(
    req: Request
) {
    try {
        const body = await req.json();
        const { content, username, mode, channel: bodyChannel } = RequestDataValidation.parse(body);

        const { searchParams } = new URL(req.url);
        const channelName = bodyChannel || searchParams.get('channel');

        if (!channelName) {
            throw new Error("Channel name is required");
        }

        const channelInfo = await getChannelInfo(channelName);
        if (!channelInfo) throw new Error("Channel not found");

        const userInfo = await getOrCreateUserInfo(username);

        const postInfo = await insertPost({
            id: -1,
            channel_id: channelInfo.id,
            user_id: userInfo.id,
            content,
            created: new Date().toISOString()
        });

        if (mode === 'test') {
            await deletePost(postInfo.id);
        }

        return Response.json(postInfo, {
            status: 200,
            headers: getCORSHeaders(req)
        });
    } catch (error: any) {
        return Response.json({ error: error.message }, {
            status: 400,
            headers: getCORSHeaders(req)
        });
    }
}
