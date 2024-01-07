import {z} from 'zod';
import {Client4} from 'mattermost-redux/client';

Client4.setUrl(`${process.env.NEXT_PUBLIC_CHAT_URL}`);
Client4.setToken(`${process.env.NEXT_PRIVATE_CHAT_BOT_TOKEN}`);

type responseBody = {
    channel: string,
    message: string,
    // ipAddress: string,
    postInfo: object | null,
    error?: string
}

type RequestData = {
    message: string,
    username: string,
    mode: string | undefined
}
const RequestDataValidation = z.object({
    message: z.string().min(1).max(256),
    username: z.string().min(1).max(18),
    mode: z.string().optional(),
});

export async function POST(
    req: Request,
    {params}: { params: { channelName: string } }
) {
    const {channelName} = params;
    const requestBody = await req.json();
    const responseBody: responseBody = {
        message: "",
        channel: channelName,
        // ipAddress: "",
        postInfo: null
    }
    try {
        const {message, username, mode} = RequestDataValidation.parse(requestBody) as RequestData;
        // const forwarded = `${req.headers["x-forwarded-for"]}`
        // const ipAddress: string = forwarded ? forwarded.split(/, /)[0] : `${req.socket.remoteAddress}`

        const messageWithUsername = `*${username} says*: ${message}`
        const channel_id = await getChannelID(channelName);

        // @ts-ignore
        const postInfo = await Client4.createPost({
            channel_id,
            message: messageWithUsername
        })

        if (mode === 'test') {
            const deletePostResult = await Client4.deletePost(postInfo.id)
        }
        return Response.json({
            ...responseBody,
            message: messageWithUsername,
            postInfo,
        }, {
            status: 200,
        })

    } catch (error: any) {
        console.log(error)
        responseBody.error = error;
        return Response.json({
            ...responseBody,
            error,
        }, {
            status: 400,
        })
    }
}


let defaultTeamID: any = null;

async function getDefaultTeamID() {
    if (defaultTeamID === null) {
        const teams = await Client4.getTeams()
        // @ts-ignore
        defaultTeamID = teams[0].id;
    }
    return defaultTeamID;
}

let mmChannelList: any = null

async function getMMChannelList() {
    if (mmChannelList === null) {
        const team_id = await getDefaultTeamID();
        mmChannelList = await Client4.getChannels(team_id);
    }
    return mmChannelList;
}

async function getChannelID(channelName: string) {
    const channels = await getMMChannelList()
    return channels.find((channelInfo: any) => channelInfo.name === channelName).id;
}

