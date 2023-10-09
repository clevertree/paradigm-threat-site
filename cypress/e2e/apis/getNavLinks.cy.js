describe('test API routes', () => {
    context("GET /api/fs/nav/chronology", () => {
        it("gets a list of nav links in chronology", () => {
            cy.request("GET", "/api/fs/nav/chronology").then((response) => {
                expect(response.status).to.eq(200)
                expect(response.headers['content-type']).to.eq('application/json; charset=utf-8')
                expect(response.body.path).to.eq('/chronology')
                expect(response.body.directories.length).to.be.greaterThan(1)
            })
        })
    })
})
