module.exports = {
    async getCatalog(type = 'movie') {
        const catalogs = {
            movie: [
                { id: 1, title: 'Inception', year: 2010, imdb: 'tt1375666' },
                { id: 2, title: 'The Dark Knight', year: 2008, imdb: 'tt0468569' },
                { id: 3, title: 'Interstellar', year: 2014, imdb: 'tt0816692' }
            ],
            series: [
                { id: 1, title: 'Breaking Bad', year: 2008, imdb: 'tt0903747' },
                { id: 2, title: 'Game of Thrones', year: 2011, imdb: 'tt0944947' }
            ],
            anime: [
                { id: 1, title: 'Attack on Titan', year: 2013, imdb: 'tt2560140' },
                { id: 2, title: 'Naruto', year: 2002, imdb: 'tt0409591' }
            ]
        };
        
        return catalogs[type] || catalogs.movie;
    },
    
    async getMeta(imdbId) {
        // جلب بيانات من IMDB/TMDB
        return {
            id: imdbId,
            title: 'Movie Title',
            description: 'Movie description here...',
            poster: 'https://image.tmdb.org/t/p/w500/poster.jpg',
            backdrop: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg',
            year: 2023,
            rating: 7.5
        };
    }
};
