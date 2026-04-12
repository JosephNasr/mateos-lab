export function getAccountTransactions(budget, account, options = {}) {
    const { sinceDate } = options;

    return ({
        uri: `https://api.ynab.com/v1/plans/${budget}/accounts/${account}/transactions`,
        ...(sinceDate ? { params: { since_date: sinceDate } } : {}),
    });
};

export function postTransaction(budget, transaction) {
    return ({
        uri: `https://api.ynab.com/v1/plans/${budget}/transactions`,
        data: { transaction },
    });
}

export function getAccount(budget, account) {
    return ({
        uri: `https://api.ynab.com/v1/plans/${budget}/accounts/${account}`,
    });
}
