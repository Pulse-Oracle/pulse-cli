import { gh } from "./github";

export async function getDiscussionId(org: string, repoName: string, number: number): Promise<string> {
  const result = await gh(
    "api", "graphql",
    "-f", `query={ repository(owner:"${org}", name:"${repoName}") { discussion(number:${number}) { id } } }`
  );
  return JSON.parse(result).data.repository.discussion.id;
}

export async function postComment(org: string, repoName: string, number: number, body: string): Promise<void> {
  const discussionId = await getDiscussionId(org, repoName, number);
  await gh(
    "api", "graphql",
    "-f", `query=mutation($body:String!) { addDiscussionComment(input: { discussionId: "${discussionId}", body: $body }) { comment { id } } }`,
    "-f", `body=${body}`
  );
}

export async function createDiscussion(
  org: string,
  repoName: string,
  title: string,
  body: string,
  category: string = "Show and tell"
): Promise<{ url: string; number: number }> {
  const meta = await gh(
    "api", "graphql",
    "-f", `query={ repository(owner:"${org}", name:"${repoName}") { id, discussionCategories(first:10) { nodes { id name } } } }`
  );
  const parsed = JSON.parse(meta).data.repository;
  const repoId = parsed.id;
  const cat = parsed.discussionCategories.nodes.find(
    (c: any) => c.name.toLowerCase() === category.toLowerCase()
  );
  if (!cat) {
    const available = parsed.discussionCategories.nodes.map((c: any) => c.name).join(", ");
    throw new Error(`Discussion category "${category}" not found. Available: ${available}`);
  }

  const result = await gh(
    "api", "graphql",
    "-f", `query=mutation($title:String!,$body:String!) { createDiscussion(input: { repositoryId: "${repoId}", categoryId: "${cat.id}", title: $title, body: $body }) { discussion { url number } } }`,
    "-f", `title=${title}`,
    "-f", `body=${body}`
  );
  return JSON.parse(result).data.createDiscussion.discussion;
}

export interface DiscussionComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export async function getDiscussionComments(
  org: string,
  repoName: string,
  number: number,
  last: number = 10
): Promise<DiscussionComment[]> {
  const result = await gh(
    "api", "graphql",
    "-f", `query={ repository(owner:"${org}", name:"${repoName}") { discussion(number:${number}) { comments(last:${last}) { nodes { id author { login } body createdAt } } } } }`
  );
  const nodes = JSON.parse(result).data.repository.discussion.comments.nodes;
  return nodes.map((n: any) => ({
    id: n.id,
    author: n.author?.login || "unknown",
    body: n.body,
    createdAt: n.createdAt,
  }));
}

export async function replyToComment(
  org: string,
  repoName: string,
  number: number,
  commentId: string,
  body: string
): Promise<void> {
  const discussionId = await getDiscussionId(org, repoName, number);
  await gh(
    "api", "graphql",
    "-f", `query=mutation($body:String!) { addDiscussionComment(input: { discussionId: "${discussionId}", body: $body, replyToId: "${commentId}" }) { comment { id } } }`,
    "-f", `body=${body}`
  );
}

export async function updateDiscussion(org: string, repoName: string, number: number, body: string): Promise<void> {
  const discussionId = await getDiscussionId(org, repoName, number);
  await gh(
    "api", "graphql",
    "-f", `query=mutation($body:String!) { updateDiscussion(input: { discussionId: "${discussionId}", body: $body }) { discussion { id } } }`,
    "-f", `body=${body}`
  );
}
