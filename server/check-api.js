
import http from 'http';

http.get('http://localhost:3001/api/listings/farmacia-bari/public', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('API Response Schema:');
            console.log('Keys:', Object.keys(json));
            if (json.details) {
                console.log('Details type:', typeof json.details);
                console.log('Details content:', JSON.stringify(json.details, null, 2));
            } else {
                console.log('Details is missing or null');
            }
        } catch (e) {
            console.error('Error parsing JSON:', e.message);
            console.log('Raw data:', data);
        }
    });
}).on('error', (err) => {
    console.error('Error: ' + err.message);
});
