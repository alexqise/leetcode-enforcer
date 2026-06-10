// Port of v1 lib/leetcode_api.js — LeetCode GraphQL. Relies on the
// browser's leetcode.com cookies (credentials: 'include'), so calls
// behave exactly as if the user made them while browsing LC.

import type { CatalogItem, DailyChallenge, ProblemMeta, RecentSubmission } from './types'

const GRAPHQL = 'https://leetcode.com/graphql/'

async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  operationName: string | null = null,
): Promise<T> {
  const res = await fetch(GRAPHQL, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables, operationName }),
  })
  if (!res.ok) throw new Error(`LeetCode GraphQL ${res.status}`)
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0]?.message || 'GraphQL error')
  return json.data as T
}

export interface LeetcodeUserStatus {
  username: string | null
  isSignedIn: boolean
}

export async function fetchCurrentUser(): Promise<LeetcodeUserStatus> {
  const data = await gql<{ userStatus: LeetcodeUserStatus }>(
    `
    query globalData {
      userStatus { username isSignedIn }
    }
  `,
    {},
    'globalData',
  )
  return data.userStatus
}

interface TopicTag {
  name: string
  slug?: string
}

export async function fetchDailyChallenge(): Promise<DailyChallenge | null> {
  const data = await gql<{
    activeDailyCodingChallengeQuestion: {
      date: string
      link: string
      question: {
        questionFrontendId: string
        title: string
        titleSlug: string
        difficulty: DailyChallenge['difficulty']
        topicTags: TopicTag[]
      }
    } | null
  }>(
    `
    query questionOfToday {
      activeDailyCodingChallengeQuestion {
        date
        link
        question {
          questionFrontendId
          title
          titleSlug
          difficulty
          topicTags { name slug }
        }
      }
    }
  `,
    {},
    'questionOfToday',
  )
  const q = data.activeDailyCodingChallengeQuestion
  if (!q) return null
  return {
    slug: q.question.titleSlug,
    number: Number.parseInt(q.question.questionFrontendId, 10),
    title: q.question.title,
    difficulty: q.question.difficulty,
    topics: q.question.topicTags.map((t) => t.name),
    url: `https://leetcode.com${q.link}`,
    date: q.date,
  }
}

export async function fetchRecentAccepted(
  username: string,
  limit = 20,
): Promise<RecentSubmission[]> {
  const data = await gql<{ recentAcSubmissionList: RecentSubmission[] | null }>(
    `
    query recentAcSubmissionList($username: String!, $limit: Int) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        id title titleSlug timestamp
      }
    }
  `,
    { username, limit },
    'recentAcSubmissionList',
  )
  return data.recentAcSubmissionList || []
}

export async function fetchProblemMeta(titleSlug: string): Promise<ProblemMeta | null> {
  const data = await gql<{
    question: {
      questionFrontendId: string
      title: string
      titleSlug: string
      difficulty: ProblemMeta['difficulty']
      topicTags: TopicTag[]
    } | null
  }>(
    `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionFrontendId title titleSlug difficulty
        topicTags { name slug }
      }
    }
  `,
    { titleSlug },
    'questionData',
  )
  const q = data.question
  if (!q) return null
  return {
    slug: q.titleSlug,
    number: Number.parseInt(q.questionFrontendId, 10),
    title: q.title,
    difficulty: q.difficulty,
    topics: q.topicTags.map((t) => t.name),
    url: `https://leetcode.com/problems/${q.titleSlug}/`,
  }
}

export async function fetchProblemCatalog(limit = 3500): Promise<CatalogItem[]> {
  const data = await gql<{
    problemsetQuestionList: {
      total: number
      questions: {
        frontendQuestionId: string
        title: string
        titleSlug: string
        difficulty: CatalogItem['difficulty']
        topicTags: TopicTag[]
        paidOnly: boolean
      }[]
    } | null
  }>(
    `
    query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
      problemsetQuestionList: questionList(
        categorySlug: $categorySlug
        limit: $limit
        skip: $skip
        filters: $filters
      ) {
        total: totalNum
        questions: data {
          frontendQuestionId: questionFrontendId
          title
          titleSlug
          difficulty
          topicTags { name }
          paidOnly: isPaidOnly
        }
      }
    }
  `,
    { categorySlug: '', skip: 0, limit, filters: {} },
    'problemsetQuestionList',
  )
  return (data.problemsetQuestionList?.questions || [])
    .filter((q) => !q.paidOnly)
    .map((q) => ({
      slug: q.titleSlug,
      number: Number.parseInt(q.frontendQuestionId, 10),
      title: q.title,
      difficulty: q.difficulty,
      topics: q.topicTags.map((t) => t.name),
      url: `https://leetcode.com/problems/${q.titleSlug}/`,
    }))
}

export async function fetchAllAcceptedSubmissions(username: string): Promise<RecentSubmission[]> {
  const all: RecentSubmission[] = []
  let limit = 100
  let chunk = await fetchRecentAccepted(username, limit)
  all.push(...chunk)
  while (chunk.length === limit && all.length < 5000) {
    limit = Math.min(limit + 100, 500)
    chunk = await fetchRecentAccepted(username, limit)
    const newOnes = chunk.filter((s) => !all.find((a) => a.id === s.id))
    if (newOnes.length === 0) break
    all.push(...newOnes)
  }
  const dedup = new Map<string, RecentSubmission>()
  for (const s of all) {
    if (!dedup.has(s.titleSlug)) dedup.set(s.titleSlug, s)
  }
  return Array.from(dedup.values())
}
