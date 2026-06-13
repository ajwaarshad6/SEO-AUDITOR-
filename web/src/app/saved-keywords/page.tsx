export default async function SavedKeywordsDashboard() {
  const { PrismaClient } = await import(`@prisma/client`);
  const prisma = new PrismaClient();

  let savedKeywords: any[] = [];
  let fetchError = ``;

  try {
    savedKeywords = await prisma.keyword.findMany({
      orderBy: { createdAt: `desc` },
      include: {
        difficulty: true,
        intent: true,
      }
    });
  } catch (error) {
    fetchError = `Failed to load saved keywords from the database.`;
  } finally {
    await prisma.$disconnect();
  }

  async function deleteKeyword(formData: any) {
    `use server`;
    const { PrismaClient } = await import(`@prisma/client`);
    const { revalidatePath } = await import(`next/cache`);
    const deletePrisma = new PrismaClient();
    
    try {
      const id = Number(formData.get(`id`));
      await deletePrisma.keyword.delete({
        where: { id: id }
      });
    } catch (error) {
      console.error(error);
    } finally {
      await deletePrisma.$disconnect();
    }
    
    revalidatePath(`/saved-keywords`);
  }

  const getIntentColor = (type?: string) => {
    if (type === `Commercial`) return `bg-blue-100 text-blue-800 border-blue-200`;
    if (type === `Informational`) return `bg-green-100 text-green-800 border-green-200`;
    if (type === `Transactional`) return `bg-purple-100 text-purple-800 border-purple-200`;
    return `bg-gray-100 text-gray-800 border-gray-200`;
  };

  const getDifficultyColor = (score?: number) => {
    if (!score) return `bg-gray-100 text-gray-800`;
    if (score > 60) return `bg-red-100 text-red-800 border-red-200`;
    if (score > 30) return `bg-orange-100 text-orange-800 border-orange-200`;
    return `bg-emerald-100 text-emerald-800 border-emerald-200`;
  };

  return (
    <div className={`p-8 max-w-7xl mx-auto`}>
      <div className={`mb-8`}>
        <h1 className={`text-3xl font-bold text-slate-800 mb-2`}>Saved Keywords</h1>
        <p className={`text-slate-500`}>Review and analyze your completely saved SEO research data.</p>
      </div>

      {fetchError && (
        <div className={`p-4 mb-6 bg-red-50 text-red-600 rounded-lg border border-red-100`}>
          {fetchError}
        </div>
      )}

      <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden`}>
        <div className={`overflow-x-auto`}>
          <table className={`w-full text-left border-collapse`}>
            <thead>
              <tr className={`bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider`}>
                <th className={`p-4 font-semibold`}>Keyword</th>
                <th className={`p-4 font-semibold`}>Market</th>
                <th className={`p-4 font-semibold`}>Difficulty</th>
                <th className={`p-4 font-semibold`}>Intent</th>
                <th className={`p-4 font-semibold`}>Date Saved</th>
                <th className={`p-4 font-semibold text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-100`}>
              {savedKeywords.length === 0 && !fetchError ? (
                <tr>
                  <td colSpan={6} className={`p-8 text-center text-slate-400`}>
                    No keywords saved yet. Run an analysis and save it to see data here.
                  </td>
                </tr>
              ) : (
                savedKeywords.map((item: any) => (
                  <tr key={item.id} className={`hover:bg-slate-50 transition-colors`}>
                    <td className={`p-4 font-medium text-slate-800`}>
                      {item.keywordText}
                    </td>
                    <td className={`p-4 text-slate-600 uppercase`}>
                      {item.language}
                    </td>
                    <td className={`p-4`}>
                      {item.difficulty ? (
                        <span className={`px-3 py-1 text-xs font-bold rounded-lg border ${getDifficultyColor(item.difficulty.kdScore)}`}>
                          {item.difficulty.kdScore} / 100
                        </span>
                      ) : (
                        <span className={`text-slate-400 text-sm`}>N/A</span>
                      )}
                    </td>
                    <td className={`p-4`}>
                      {item.intent ? (
                        <span className={`px-3 py-1 text-xs font-bold rounded-lg border ${getIntentColor(item.intent.primaryIntent)}`}>
                          {item.intent.primaryIntent}
                        </span>
                      ) : (
                        <span className={`text-slate-400 text-sm`}>N/A</span>
                      )}
                    </td>
                    <td className={`p-4 text-slate-500 text-sm`}>
                      {new Date(item.createdAt).toLocaleDateString(`en-US`, {
                        year: `numeric`,
                        month: `short`,
                        day: `numeric`
                      })}
                    </td>
                    <td className={`p-4 text-right`}>
                      <form action={deleteKeyword}>
                        <input type={`hidden`} name={`id`} value={item.id} />
                        <button 
                          type={`submit`}
                          className={`px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100 transition-colors`}
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}