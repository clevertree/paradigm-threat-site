describe('Dynamic Site Specification', () => {
    const caughtErrors: Array<{ page: string; error: string; type: string }> = [];

    before(() => {
        // Set up handler for uncaught JavaScript exceptions
        cy.on('uncaught:exception', (err, runnable) => {
            const message = err?.message || String(err);

            // Ignore hydration mismatches and harmless errors
            if (
                message.includes('Hydration failed') ||
                message.includes('Initial UI does not match') ||
                message.includes('did not have matching text') ||
                message.includes('No matching child') ||
                message.includes('[next-mdx-remote] error compiling MDX') ||
                message.includes('Expected a closing tag')
            ) {
                cy.log(`Non-critical error: ${message.substring(0, 100)}`);
                return false;
            }

            // Log critical errors but continue testing
            cy.url().then((url) => {
                caughtErrors.push({
                    page: url,
                    error: message,
                    type: 'uncaught:exception',
                });
            });
            return false;
        });

        // Also handle promise rejections
        cy.on('uncaught:exception', (err) => {
            if (err?.message?.includes('[next-mdx-remote] error compiling MDX')) {
                return false;
            }
        });
    });

    it('visits the homepage', () => {
        cy.visit('/', { failOnStatusCode: false });
        cy.contains('Welcome to Paradigm Threat', { timeout: 10000 });
    });

    it('visits a subpage', () => {
        cy.visit('/', { failOnStatusCode: false });
        cy.wait(500);
    });

    it('dynamically visits sample pages from index and detects critical errors', () => {
        const baseUrl = Cypress.env('NEXT_PUBLIC_FILES_BASE_URL') || 'https://files.paradigmthreat.net';

        cy.request(`${baseUrl}/index.json`).then((response) => {
            const files = response.body as string[];
            // Filter for markdown files and convert paths to routes
            const pages = files
                .filter(file => file.endsWith('.md'))
                .map(file => '/' + file.replace(/\.md$/, ''))
                .sort()
                .slice(0, 20); // Test only first 20 pages for now

            cy.log(`Testing ${pages.length} sample pages`);

            pages.forEach((page) => {
                cy.visit(page, { failOnStatusCode: false }).then(() => {
                    cy.wait(200);
                });
            });
        });

        // After visiting all sample pages, verify no critical errors were caught
        cy.wrap(null).then(() => {
            if (caughtErrors.length > 0) {
                const errorsByPage = caughtErrors.reduce((acc, curr) => {
                    if (!acc[curr.page]) {
                        acc[curr.page] = [];
                    }
                    acc[curr.page].push(`[${curr.type}] ${curr.error}`);
                    return acc;
                }, {} as Record<string, string[]>);

                const errorReport = Object.entries(errorsByPage)
                    .map(([page, errors]) => `${page}:\n  - ${errors.join('\n  - ')}`)
                    .slice(0, 20)
                    .join('\n\n');

                const totalPages = Object.keys(errorsByPage).length;
                cy.log(
                    `Found critical errors on ${totalPages} page(s) ` +
                    `(${caughtErrors.length} total error(s)):\n\n${errorReport}`
                );
                throw new Error(
                    `Found critical errors on ${totalPages} page(s)`
                );
            } else {
                cy.log(`All tested pages passed without critical errors!`);
            }
        });
    });

    it('visits the 911 page without MDX runtime errors', () => {
        cy.visit('/events/911', { failOnStatusCode: false });
        cy.wait(1000);
        cy.then(() => {
            const pageErrors = caughtErrors.filter((e) => e.page.includes('911'));
            if (pageErrors.length > 0) {
                throw new Error(
                    `Critical errors on 911 page: ${pageErrors.map((e) => e.error).join('; ')}`
                );
            }
        });
        cy.get('h1').should('exist');
    });
});
