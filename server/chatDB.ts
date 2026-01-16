import { sql } from "@vercel/postgres";

export interface ChannelInfo {
    id: number;
    name: string;
    description: string;
}

export interface UserInfo {
    id: number;
    username: string;
    email?: string;
    full_name?: string;
}

export interface PostInfo {
    id: number;
    user_id: number;
    channel_id: number;
    created: string;
    content: string;
    username?: string;
    user_email?: string;
}

export async function getChannelPosts(channelName: string, limit: number = 50) {
    const { rows } = await sql`
        SELECT p.*, u.username, u.email as user_email
        FROM posts p
        JOIN channels c ON p.channel_id = c.id
        JOIN users u ON p.user_id = u.id
        WHERE c.name = ${channelName}
        ORDER BY p.created DESC
        LIMIT ${limit};
    `;
    return rows as Array<PostInfo>;
}

export async function getChannelInfo(channelName: string) {
    const { rows } = await sql`
        SELECT *
        FROM channels
        WHERE name = ${channelName};
    `;
    return rows[0] as ChannelInfo;
}

export async function getChannelList() {
    const { rows } = await sql`
        SELECT *
        FROM channels;
    `;
    return rows as Array<ChannelInfo>;
}

export async function insertPost(post: PostInfo) {
    const { rows } = await sql`
        INSERT INTO posts (user_id, channel_id, content, created)
        VALUES (${post.user_id}, ${post.channel_id}, ${post.content}, ${post.created})
        RETURNING *;
    `;
    return rows[0] as PostInfo;
}

export async function deletePost(id: number) {
    await sql`DELETE FROM posts WHERE id = ${id};`;
}

export async function insertUser({ username, full_name, email }: UserInfo) {
    await sql`
        INSERT INTO users (username, full_name, email)
        VALUES (${username}, ${full_name}, ${email})
        ON CONFLICT (username) DO UPDATE SET full_name = ${full_name}, email = ${email};
    `;
    const { rows } = await sql`
        SELECT * FROM users WHERE username = ${username} LIMIT 1;
    `;
    return rows[0] as UserInfo;
}

export async function getUserInfo(username: string) {
    const { rows } = await sql`
        SELECT * FROM users WHERE username = ${username};
    `;
    return rows[0] as UserInfo;
}

export async function getOrCreateUserInfo(username: string) {
    let userInfo = await getUserInfo(username);
    if (!userInfo) {
        userInfo = await insertUser({ id: -1, username });
    }
    return userInfo;
}
