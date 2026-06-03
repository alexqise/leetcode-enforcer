const GRAPHQL = 'https://leetcode.com/graphql/';

async function gql(query, variables = {}, operationName = null) {
  const res = await fetch(GRAPHQL, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ query, variables, operationName })
  });
  if (!res.ok) throw new Error(`LeetCode GraphQL ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || 'GraphQL error');
  return json.data;
}

export async function fetchCurrentUser() {
  const data = await gql(`
    query globalData {
      userStatus { username isSignedIn }
    }
  `, {}, 'globalData');
  return data.userStatus;
}

export async function fetchDailyChallenge() {
  const data = await gql(`
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
  `, {}, 'questionOfToday');
  const q = data.activeDailyCodingChallengeQuestion;
  if (!q) return null;
  return {
    slug: q.question.titleSlug,
    number: parseInt(q.question.questionFrontendId, 10),
    title: q.question.title,
    difficulty: q.question.difficulty,
    topics: q.question.topicTags.map(t => t.name),
    url: `https://leetcode.com${q.link}`,
    date: q.date
  };
}

export async function fetchRecentAccepted(username, limit = 20) {
  const data = await gql(`
    query recentAcSubmissionList($username: String!, $limit: Int) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        id title titleSlug timestamp
      }
    }
  `, { username, limit }, 'recentAcSubmissionList');
  return data.recentAcSubmissionList || [];
}

export async function fetchProblemMeta(titleSlug) {
  const data = await gql(`
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionFrontendId title titleSlug difficulty
        topicTags { name slug }
      }
    }
  `, { titleSlug }, 'questionData');
  const q = data.question;
  if (!q) return null;
  return {
    slug: q.titleSlug,
    number: parseInt(q.questionFrontendId, 10),
    title: q.title,
    difficulty: q.difficulty,
    topics: q.topicTags.map(t => t.name),
    url: `https://leetcode.com/problems/${q.titleSlug}/`
  };
}

export async function fetchProblemCatalog(limit = 3500) {
  const data = await gql(`
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
  `, { categorySlug: '', skip: 0, limit, filters: {} }, 'problemsetQuestionList');
  const items = (data.problemsetQuestionList?.questions || [])
    .filter(q => !q.paidOnly)
    .map(q => ({
      slug: q.titleSlug,
      number: parseInt(q.frontendQuestionId, 10),
      title: q.title,
      difficulty: q.difficulty,
      topics: q.topicTags.map(t => t.name),
      url: `https://leetcode.com/problems/${q.titleSlug}/`
    }));
  return items;
}

export async function fetchAllAcceptedSubmissions(username) {
  const all = [];
  let limit = 100;
  let chunk = await fetchRecentAccepted(username, limit);
  all.push(...chunk);
  while (chunk.length === limit && all.length < 5000) {
    limit = Math.min(limit + 100, 500);
    chunk = await fetchRecentAccepted(username, limit);
    const newOnes = chunk.filter(s => !all.find(a => a.id === s.id));
    if (newOnes.length === 0) break;
    all.push(...newOnes);
  }
  const dedup = new Map();
  for (const s of all) {
    if (!dedup.has(s.titleSlug)) dedup.set(s.titleSlug, s);
  }
  return Array.from(dedup.values());
}
