describe('template spec', () => {
    it('passes', () => {
        const filesBaseUrl = 'https://files.paradigmthreat.net'; // Fallback or use env
        cy.request(`${filesBaseUrl}/index.json`).then((response) => {
            const fileList: string[] = response.body;
            const paths = new Set<string>();
            fileList.forEach((file: string) => {
                const parts = file.split('/');
                const path = '/' + parts.slice(0, -1).join('/');
                paths.add(path);
            });

            Array.from(paths).forEach((path) => {
                if (path === '/') return;
                cy.visit(path);
            });
        });
    });
});
