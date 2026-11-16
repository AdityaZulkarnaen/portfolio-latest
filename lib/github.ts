export type ContributionDay = {
  date: string;
  count: number;
  level: number;
};

export type GitHubActivityData = {
  username: string;
  totalContributions: number;
  publicRepos: number;
  followers: number;
  longestStreak: number;
  currentStreak: number;
  contributions: ContributionDay[];
};

export async function getGitHubActivity(): Promise<GitHubActivityData> {
  const username = "AdityaZulkarnaen";

  try {
    const [contribRes, userRes] = await Promise.allSettled([
      fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`, {
        next: { revalidate: 3600 },
        headers: { Accept: "application/json" },
      }),
      fetch(`https://api.github.com/users/${username}`, {
        next: { revalidate: 3600 },
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Aditya-Portfolio",
        },
      }),
    ]);

    let totalContributions = 0;
    let contributions: ContributionDay[] = [];
    let longestStreak = 0;
    let currentStreak = 0;

    if (contribRes.status === "fulfilled" && contribRes.value.ok) {
      const contribData = await contribRes.value.json();
      totalContributions = contribData?.total?.lastYear ?? 0;
      contributions = contribData?.contributions ?? [];

      let streak = 0;
      for (let i = 0; i < contributions.length; i++) {
        if (contributions[i].count > 0) {
          streak++;
          if (streak > longestStreak) longestStreak = streak;
        } else {
          streak = 0;
        }
      }

      for (let i = contributions.length - 1; i >= 0; i--) {
        if (contributions[i].count > 0) {
          currentStreak++;
        } else if (i < contributions.length - 2) {
          break;
        }
      }
    }

    let publicRepos = 62;
    let followers = 35;

    if (userRes.status === "fulfilled" && userRes.value.ok) {
      const userData = await userRes.value.json();
      if (typeof userData.public_repos === "number") publicRepos = userData.public_repos;
      if (typeof userData.followers === "number") followers = userData.followers;
    }

    if (contributions.length === 0) {
      totalContributions = 1041;
      longestStreak = 16;
      currentStreak = 4;
      const today = new Date();
      for (let i = 365; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const seed = Math.sin(i * 12.9898) * 43758.5453;
        const rand = seed - Math.floor(seed);
        const count = rand > 0.45 ? Math.floor(rand * 8) : 0;
        const level = count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4;
        contributions.push({ date: dateStr, count, level });
      }
    }

    return {
      username,
      totalContributions,
      publicRepos,
      followers,
      longestStreak,
      currentStreak,
      contributions,
    };
  } catch (error) {
    console.error("Error fetching GitHub activity:", error);
    // Safe deterministic fallback
    const contributions: ContributionDay[] = [];
    const today = new Date();
    for (let i = 365; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const seed = Math.sin(i * 12.9898) * 43758.5453;
      const rand = seed - Math.floor(seed);
      const count = rand > 0.45 ? Math.floor(rand * 8) : 0;
      const level = count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4;
      contributions.push({ date: dateStr, count, level });
    }
    return {
      username,
      totalContributions: 1041,
      publicRepos: 62,
      followers: 35,
      longestStreak: 16,
      currentStreak: 4,
      contributions,
    };
  }
}
