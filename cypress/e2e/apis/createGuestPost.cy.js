/// <reference types="cypress" />


describe('test API routes', () => {
    context("POST /api/chat/channels/development/createGuestPost", () => {
        it("create a posts in development chat", () => {
            cy.request("POST", "/api/chat/channels/development/createGuestPost", {
                message: "This is a test message from a cypress e2e test",
                username: "cypress",
                mode: 'test'
            }).then((response) => {
                expect(response.status).to.eq(200)
                expect(response.body.channel).to.eq('development')
                expect(response.body.postInfo.message).to.eq('*cypress says*: This is a test message from a cypress e2e test')
                // expect(response.body.post).to.be.eq(15)
            })
        })
    })
})
