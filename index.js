const fetch = require("node-fetch")
const events = require("events")

const Exception = require("./src/exception")
const headers = require("./src/headers")
const query = require("./src/query")
const config = require("./config")

const emitter = new events.EventEmitter()

class Client {
	constructor() {
		this.details = {}
	}
	on(e, cb) {
		emitter.addListener(e, cb)
	}
    async login(connect_sid) {
		if(!connect_sid) {
			throw new Exception("no connect_sid supplied")
		}
		
		global.cookies = `connect.sid: ${connect_sid};`
		// emitter.emit("ready", null)
	}
	async create({ title, body, board }) {
		if(!title || !body || !board) {
			throw new Exception("failed to create post, missing title, body or board")
		}
		else if(!config.boards.hasOwnProperty(board)) {
			throw new Exception("invalid board", board)
		}

		const post = await query({
			query: "mutation createPost($input: CreatePostInput!){createPost(input: $input){post{url}}}",
			variables: {
				input: { title, body, boardId: config.boards[board] }
			}
		})

		console.log(post)
	}


	async getPost(id) {
		if(!id) throw new Exception('Cannot find post without an id.')
		let json = await query({
			query: 
				`query{
					post(id: ${id}){
						recentComments {
							body, id, user {
								id
							}
						}
						id title url isAuthor isLocked commentCount body isAnnouncement isAnswerable timeCreated canEdit canComment canPin canSetType canReport hasReported isLocked showHosted voteCount canVote hasVoted
					}
				}`
		})
		let relevant = json.post

		relevant.remove = () => {
			return query({
				query: 'mutation remove($id: Int!){remove(id: $id){id}}',
				variables: {
					id: relevant.id
				}
			})
		}
		relevant.upvote = () => {
			return query({
				query: 'mutation createPostVote($postId: Int!){createPostVote(postId: $postId){id}}',
				variables: {
					postId: relevant.id
				}
			})
		}
		relevant.comment = (body) => {
			return query({
				query: "mutation CreateComment($input: CreateCommentInput!){createComment(input: $input){comment{id}}}",
				variables: {
					input: {
						postId: relevant.id,
						body: body
					}
				}
			})
			.then(json => {
				return json.createComment.comment
			})
		}
		return relevant
	}
	getPosts({order, boards, pinned, count, searchQuery, languages}) {
		let variables = {
			searchQuery: searchQuery || null,
			order: order || null,
			languages: languages || [],
			boardSlugs: boards || ['all'],
			pinPinned: pinned || false,
			count: count || 1
		}
		return query({
			query: "query PostsFeed($order: String, $after: String, $searchQuery: String, $languages: [String!], $count: Int, $boardSlugs: [String!], $pinAnnouncements: Boolean, $pinPinned: Boolean){posts(order: $order, after: $after, searchQuery: $searchQuery, languages: $languages, count: $count, boardSlugs: $boardSlugs, pinAnnouncements: $pinAnnouncements, pinPinned: $pinPinned){items {id timeCreated}}}",
			variables
		})
		.then(json => {
			return json.posts.items || {}
		})
	}
	getUser(id) {
		if(!id) throw new Exception('Cannot find user without an id/username.')

		// const user = await query({
		// 	query: ``
		// })

		// if(typeof id == "string")
		// 	query = `query{userByUsername(username: "${id}"){username id url image isHacker isVerified timeCreated fullName displayName}}`
		// else 
		// 	query = `query{user(id: ${id}){username id url image isHacker  isVerified timeCreated fullName displayName}}`

		// return query({
		// 	query:
		// })
	}
	async getComment(id) {
		let json = await query({
			query: 
				`query{
					comment(id: ${id}){
						body id canEdit canComment voteCount canVote hasVoted
						user {
							id username
						}
					}
				}`
		})
		let comment = json.comment
		comment.reply = (body) => {
			return query({
				query: `mutation CreateComment($input: CreateCommentInput!){createComment(input: $input){comment{id}}}`,
				variables: {
					input: {
						body,
						commentId: comment.id,
					}
				}
			})
		}
		comment.upvote = () => {
			return query({
				query: 'mutation createCommentVote($commentId: Int!){createCommentVote(commentId: $commentId){id}}',
				variables: {
					commentId: comment.id
				}
			})
		}
		return comment
	}
}

module.exports = Client