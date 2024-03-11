import Directory from "../app/directory.json"

type DirectoryType = {
    [name: string]: DirectoryType
}

describe('template spec', () => {
    it('passes', () => {

        function visitPathsInDirectory(path: string, directory: DirectoryType) {
            Object.keys(directory).forEach(subPath => {
                const currentPath = `${path}/${subPath}`;
                cy.visit(currentPath)
                visitPathsInDirectory(currentPath, directory[subPath])
            })
        }

        visitPathsInDirectory('/', Directory);

    })
})