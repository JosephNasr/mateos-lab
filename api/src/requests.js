
export function getAccountTransactions(budget, account) {
    return ({
        uri: `https://api.ynab.com/v1/plans/${budget}/accounts/${account}/transactions`,
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

export function getGoldPrice() {
    return ({
        uri: `https://api.gold-api.com/price/XAU`
    });
}

export function getBeirutWeatherData() {
    return ({
        uri: `https://api.open-meteo.com/v1/forecast?latitude=33.8933&longitude=35.5016&daily=apparent_temperature_max,apparent_temperature_min,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,precipitation_hours,showers_sum,wind_speed_10m_max,wind_gusts_10m_max,weather_code,sunrise,sunset,uv_index_max,uv_index_clear_sky_max,relative_humidity_2m_mean,dew_point_2m_mean,cloud_cover_mean&hourly=apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m&timezone=auto&forecast_days=1&forecast_hours=12`
    });
}
