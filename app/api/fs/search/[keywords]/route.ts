// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import {searchFileContentRecursive, searchFileNamesRecursive} from "@/server/fileUtil.js";


export async function GET(
    req: Request,
    {params}: { params: { keywords: string } }
) {
    try {
        const keywords = `${params.keywords}`;
        const pages = await searchFileContentRecursive(keywords)
        const files = await searchFileNamesRecursive(keywords)
        return Response.json({
            pages,
            files,
            params
        }, {
            status: 200,
        })

    } catch (error: any) {
        console.log(error)
        return Response.json({
            results: [],
            error,
            params
        }, {
            status: 400,
        })
    }
}
