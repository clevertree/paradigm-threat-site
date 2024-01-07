// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import {Client4} from 'mattermost-redux/client';

const POSTS_PER_PAGE = 15
Client4.setUrl(`${process.env.NEXT_PUBLIC_CHAT_URL}`);
Client4.setToken(`${process.env.NEXT_PRIVATE_CHAT_BOT_TOKEN}`);

type Data = {
    channel: string,
    posts: object[],
    params: object,
    error?: object
}

export async function GET(
    req: Request,
    {params}: { params: { channelName: string } }
) {
    try {
        const channelName = `${params.channelName}`;
        const posts = await getChannelPosts(channelName)
        return Response.json({
            channel: channelName,
            posts,
            params
        }, {
            status: 200,
        })

    } catch (error: any) {
        console.log(error)
        return Response.json({
            channel: "", posts: [],
            error,
            params
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

async function getChannelPosts(channelName: string) {
    const users = await getMMUserList();
    const channelID = await getChannelID(channelName);
    // const teamID = await getDefaultTeamID();
    const posts = await Client4.getPosts(channelID, 0, POSTS_PER_PAGE)
    return posts.order.reverse().map(postID => {
        // @ts-ignore
        const postInfo = posts.posts[postID];
        const username = users.find((userInfo: any) => userInfo.id === postInfo.user_id).username;
        return {
            username,
            message: postInfo.message,
        }
    })
}


let mmUserList: any = null;

async function getMMUserList() {
    if (mmUserList === null) {
        mmUserList = await Client4.getProfiles();
    }
    return mmUserList;

}
