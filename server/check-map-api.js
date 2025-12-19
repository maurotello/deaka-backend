
import http from 'http';

http.get('http://localhost:3001/api/listings?search=bari', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data); // Expecting an array
            console.log('API Response Schema (First Item):');
            if (Array.isArray(json) && json.length > 0) {
                const item = json[0];
                console.log('Keys:', Object.keys(item));
                if (item.details) {
                    console.log('Details type:', typeof item.details);
                    console.log('Details content:', JSON.stringify(item.details).substring(0, 100) + '...');
                } else {
                    console.log('Details is missing or null');
                }
            } else {
                console.log('No items returned or not an array');
            }

        } catch (e) {
            console.error('Error parsing JSON:', e.message);
            console.log('Raw data:', data);
        }
    });
}).on('error', (err) => {
    console.error('Error: ' + err.message);
});
