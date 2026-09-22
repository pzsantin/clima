const container = document.querySelector('#container');
const searchInput = document.querySelector('#nome_da_cidade');
const locationsList = document.querySelector('#localidades');
const apiKey = 'f10d4b19e8f434afb522dc5b728ab06a';
let suggestionTimer;
let suggestionRequest;

const brazilianStates = {
    'acre': 'Rio Branco',
    'alagoas': 'Maceió',
    'amapá': 'Macapá',
    'amazonas': 'Manaus',
    'bahia': 'Salvador',
    'ceará': 'Fortaleza',
    'distrito federal': 'Brasília',
    'espírito santo': 'Vitória',
    'goiás': 'Goiânia',
    'maranhão': 'São Luís',
    'mato grosso': 'Cuiabá',
    'mato grosso do sul': 'Campo Grande',
    'minas gerais': 'Belo Horizonte',
    'pará': 'Belém',
    'paraíba': 'João Pessoa',
    'paraná': 'Curitiba',
    'pernambuco': 'Recife',
    'piauí': 'Teresina',
    'rio de janeiro': 'Rio de Janeiro',
    'rio grande do norte': 'Natal',
    'rio grande do sul': 'Porto Alegre',
    'rondônia': 'Porto Velho',
    'roraima': 'Boa Vista',
    'santa catarina': 'Florianópolis',
    'são paulo': 'São Paulo',
    'sergipe': 'Aracaju',
    'tocantins': 'Palmas',
};

const stateCodes = {
    'Acre': 'AC',
    'Alagoas': 'AL',
    'Amapá': 'AP',
    'Amazonas': 'AM',
    'Bahia': 'BA',
    'Ceará': 'CE',
    'Distrito Federal': 'DF',
    'Espírito Santo': 'ES',
    'Goiás': 'GO',
    'Maranhão': 'MA',
    'Mato Grosso': 'MT',
    'Mato Grosso do Sul': 'MS',
    'Minas Gerais': 'MG',
    'Pará': 'PA',
    'Paraíba': 'PB',
    'Paraná': 'PR',
    'Pernambuco': 'PE',
    'Piauí': 'PI',
    'Rio de Janeiro': 'RJ',
    'Rio Grande do Norte': 'RN',
    'Rio Grande do Sul': 'RS',
    'Rondônia': 'RO',
    'Roraima': 'RR',
    'Santa Catarina': 'SC',
    'São Paulo': 'SP',
    'Sergipe': 'SE',
    'Tocantins': 'TO',
};

searchInput.addEventListener('input', () => {
    clearTimeout(suggestionTimer);
    const query = searchInput.value.trim();

    if (query.length < 2) {
        locationsList.replaceChildren();
        return;
    }

    suggestionTimer = setTimeout(() => loadSuggestions(query), 300);
});

container.addEventListener('pointermove', (event) => {
    const bounds = container.getBoundingClientRect();
    container.style.setProperty('--spotlight-x', `${event.clientX - bounds.left}px`);
    container.style.setProperty('--spotlight-y', `${event.clientY - bounds.top}px`);
});

document.querySelector('#search').addEventListener('submit', async (Event)=>{
    Event.preventDefault();

    const nome_da_cidade = searchInput.value.trim();

    if (!nome_da_cidade){
        document.querySelector("#clima").classList.remove('show');
        showalert('Digite o nome da cidade...')
        return;
    }

    try {
        const location = await findLocation(nome_da_cidade);
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lon}&appid=${apiKey}&units=metric&lang=pt_br`;
        const results = await fetch(apiUrl);
        const json = await results.json();

        if (json.cod === 200) {
            const extremes = await getDayExtremes(json, apiKey);
            showinfo({
                city: location.name || json.name,
                state: location.state,
                country: location.country || json.sys.country,
                isState: location.isStateSearch,
                temp: json.main.temp,
                tempMax: extremes.max,
                tempMin: extremes.min,
                description: extremes.description,
                weather: extremes.weather,
                weatherId: extremes.weatherId,
                tempIcon: extremes.icon,
                windSpeed: json.wind.speed,
                humidity: json.main.humidity,
                timestamp: json.dt,
                sunrise: json.sys.sunrise,
                sunset: json.sys.sunset,

            });
        } else {
            throw new Error('cidade não encontrada');
        }
    } catch (error) {
        document.querySelector("#clima").classList.remove('show');
        showalert(`Não foi possivel localizar a cidade
            <img src="SRC/images/nao-encontrado.png"/>
            `)
    }

});

async function getDayExtremes(currentWeather, apiKey) {
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURI(currentWeather.name)}&appid=${apiKey}&units=metric&lang=pt_br`;
    const response = await fetch(forecastUrl);
    if (!response.ok) {
        return {
            max: currentWeather.main.temp_max,
            min: currentWeather.main.temp_min,
            ...getWeatherPresentation(currentWeather),
        };
    }

    const forecast = await response.json();
    const localDate = new Date((currentWeather.dt + currentWeather.timezone) * 1000)
        .toISOString().slice(0, 10);
    const today = forecast.list.filter((item) => {
        const itemDate = new Date((item.dt + forecast.city.timezone) * 1000)
            .toISOString().slice(0, 10);
        return itemDate === localDate;
    });

    if (!today.length) {
        return {
            max: currentWeather.main.temp_max,
            min: currentWeather.main.temp_min,
            ...getWeatherPresentation(currentWeather),
        };
    }

    const temperatures = today.map((item) => item.main.temp);
    const presentation = getWeatherPresentation(currentWeather, forecast.list[0]);
    return {
        max: Math.max(...temperatures, currentWeather.main.temp),
        min: Math.min(...temperatures, currentWeather.main.temp),
        ...presentation,
    };
}

async function findLocation(query) {
    const stateKey = query.toLocaleLowerCase('pt-BR');
    const stateCapital = brazilianStates[stateKey];
    const searchQuery = stateCapital || query;
    const response = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(searchQuery)}&limit=1&appid=${apiKey}`);
    const locations = await response.json();

    if (!response.ok || !locations.length) {
        throw new Error('localidade não encontrada');
    }

    if (stateCapital) {
        return {
            ...locations[0],
            name: query,
            state: null,
            isStateSearch: true,
        };
    }

    return locations[0];
}

async function loadSuggestions(query) {
    if (suggestionRequest) suggestionRequest.abort();
    suggestionRequest = new AbortController();

    try {
        const response = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${apiKey}`, {
            signal: suggestionRequest.signal,
        });
        const locations = await response.json();
        locationsList.replaceChildren(...locations.map((location) => {
            const option = document.createElement('option');
            option.value = formatLocation(location, true);
            return option;
        }));
    } catch (error) {
        if (error.name !== 'AbortError') locationsList.replaceChildren();
    }
}

function formatLocation(location, includeCountry = false, abbreviateState = false) {
    const parts = [location.name];
    if (location.state) {
        parts.push(abbreviateState ? stateCodes[location.state] || location.state : location.state);
    }
    if (includeCountry && location.country) parts.push(location.country);
    return parts.filter(Boolean).join(', ');
}

function getWeatherPresentation(currentWeather, nearTermForecast) {
    const current = currentWeather.weather[0];
    const next = nearTermForecast?.weather?.[0];
    const hasNearTermOpening = current.id === 804 && next && [800, 801, 802].includes(next.id);
    const weather = hasNearTermOpening ? next : current;

    return {
        description: getWeatherDescription(weather),
        weather: weather.main,
        weatherId: weather.id,
        icon: weather.icon,
    };
}

function getWeatherDescription(weather) {
    if (weather.id === 800) return 'Céu limpo';
    if ([801, 802].includes(weather.id)) return 'Sol entre nuvens';
    if (weather.id === 803) return 'Nublado com aberturas';
    return weather.description;
}

function showinfo(Json){
    showalert('');

    document.querySelector("#clima").classList.add('show');
    applyWeatherTheme(Json);

    document.querySelector('#title').innerHTML = formatLocation({
        name: Json.city,
        state: Json.state,
        country: Json.country,
    }, Json.isState, !Json.isState);

    document.querySelector('#temp_value').innerHTML = `${Json.temp.toFixed(0)}°C`;
    document.querySelector('#temp_description').innerHTML = `${Json.description}`;
    document.querySelector('#temp_img').setAttribute('src',`https://openweathermap.org/img/wn/${Json.tempIcon}@2x.png`)
    document.querySelector('#temp_max').innerHTML = `${Json.tempMax.toFixed(0)}°C`;
    document.querySelector('#temp_min').innerHTML = `${Json.tempMin.toFixed(0)}°C`;

    document.querySelector('#humidity').innerHTML = `${Json.humidity}%`;

    document.querySelector('#wind').innerHTML = `${(Json.windSpeed * 3.6).toFixed(0)} km/h`;
}

function applyWeatherTheme(weatherData) {
    const theme = getWeatherTheme(weatherData);
    container.style.setProperty('--weather-start', theme.start);
    container.style.setProperty('--weather-end', theme.end);
    container.style.setProperty('--weather-glow', theme.glow);
    container.style.setProperty('--weather-accent', theme.accent);
}

function getWeatherTheme({ weather, weatherId, timestamp, sunrise, sunset }) {
    const isNight = timestamp < sunrise || timestamp > sunset;
    const isGoldenHour = !isNight && Math.min(
        Math.abs(timestamp - sunrise),
        Math.abs(timestamp - sunset),
    ) <= 90 * 60;

    if (isNight) {
        return { start: '#17253d', end: '#283454', glow: 'rgba(128, 166, 235, .22)', accent: '#a9c7ff' };
    }

    if (weather === 'Thunderstorm') {
        return { start: '#252344', end: '#4a3d72', glow: 'rgba(182, 155, 255, .2)', accent: '#d0baff' };
    }

    if (weather === 'Rain' || weather === 'Drizzle') {
        return { start: '#3c5669', end: '#58798a', glow: 'rgba(159, 214, 230, .18)', accent: '#a9e1ef' };
    }

    if (weather === 'Snow') {
        return { start: '#718ea6', end: '#b6cbd8', glow: 'rgba(238, 249, 255, .3)', accent: '#effaff' };
    }

    if (['Mist', 'Fog', 'Haze', 'Smoke', 'Dust', 'Sand', 'Ash', 'Squall', 'Tornado'].includes(weather)) {
        return { start: '#626b6b', end: '#929994', glow: 'rgba(231, 237, 225, .18)', accent: '#dce8d8' };
    }

    if (weather === 'Clouds') {
        if (weatherId >= 803) {
            return { start: '#59636d', end: '#7c8790', glow: 'rgba(218, 228, 231, .18)', accent: '#e1ebed' };
        }

        if (isGoldenHour) {
            return { start: '#cb7541', end: '#e1aa61', glow: 'rgba(255, 218, 151, .28)', accent: '#fff0c8' };
        }

        return { start: '#5f91b1', end: '#91b9c9', glow: 'rgba(224, 246, 255, .25)', accent: '#e9faff' };
    }

    if (isGoldenHour) {
        return { start: '#c96138', end: '#ecaa59', glow: 'rgba(255, 213, 130, .35)', accent: '#fff0c4' };
    }

    return { start: '#2479b5', end: '#55b6d0', glow: 'rgba(224, 249, 255, .3)', accent: '#effcff' };
}

function showalert(msg) {
    document.querySelector('#alert').innerHTML = msg;
}