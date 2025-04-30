const axios = require('axios');

function extractJSON(text) {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonString = text.slice(jsonStart, jsonEnd + 1);
        try {
            return JSON.parse(jsonString);
        } catch {
            throw new Error('Invalid JSON in response');
        }
    }
    throw new Error('No valid JSON found in response');
}

// exports.parseResume = async (req, res) => {
//     const { resume: resumeText, appliedJobTitle } = req.body;
//     if (!resumeText) return res.status(400).json({ error: 'Resume text is required' });

//     try {
//         const generalResponse = await axios.post(
//             'https://api.openai.com/v1/chat/completions',
//             {
//                 model: 'gpt-3.5-turbo',
//                 temperature: 0.2,
//                 max_tokens: 800,
//                 messages: [
//                     {
//                         role: 'user',
//                         content: `Extract the following fields from the resume text:

//       firstName, lastName, email, phoneNumber, linkedinProfile, location (with address, city, country, postcode), blog, portfolio, currentPosition, summary, skills (array), education (with degree, institution, from, to, city, region, description), certifications (array), projects (array with title, year, description), communication, leadership, references, awardsandAcknowledgements (array), interests (array)

//       Return ONLY valid JSON in this format (exclude experience):

//       {
//         "firstName": "",
//         "lastName": "",
//         "email": "",
//         "phoneNumber": "",
//         "linkedinProfile": "",
//         "location": {
//           "address": "",
//           "city": "",
//           "country": "",
//           "postcode": ""
//         },
//         "blog": "",
//         "portfolio": "",
//         "currentPosition": "",
//         "summary": "",
//         "skills": [],
//         "education": [{
//           "degree": "",
//           "institution": "",
//           "from": "",
//           "to": "",
//           "city": "",
//           "region": "",
//           "description": ""
//         }],
//         "certifications": [],
//         "projects": [{
//           "title": "",
//           "year": "",
//           "description": ""
//         }],
//         "communication": "",
//         "leadership": "",
//         "references": "",
//         "awardsandAcknowledgements": [],
//         "interests": []
//       }

//       Resume Text:
//       ${resumeText}`
//                     }
//                 ]
//             },
//             {
//                 headers: {
//                     'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
//                     'Content-Type': 'application/json'
//                 }
//             }
//         );

//         const generalData = extractJSON(generalResponse.data.choices[0].message.content);

//         const experienceResponse = await axios.post(
//             'https://api.openai.com/v1/chat/completions',
//             {
//                 model: 'gpt-4o',
//                 temperature: 0.2,
//                 max_tokens: 2000,
//                 messages: [
//                     {
//                         role: 'user',
//                         content: `Extract only job experience from the resume text.
//       Return only valid JSON in the format:

//       "experience": [
//         {
//           "from": "",
//           "to": "",
//           "companyName": "",
//           "position": "",
//           "responsibilities": ""
//         }
//       ]

//       Resume Text:
//       ${resumeText}`
//                     }
//                 ]
//             },
//             {
//                 headers: {
//                     'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
//                     'Content-Type': 'application/json'
//                 }
//             }
//         );

//         const experienceData = extractJSON(experienceResponse.data.choices[0].message.content);

//         const finalResult = {
//             ...generalData,
//             ...experienceData,
//             appliedJobTitle: appliedJobTitle || ""
//         };

//         res.json(finalResult);

//     } catch (error) {
//         console.error('Error parsing resume:', error.message);
//         res.status(500).json({ error: 'Failed to parse resume' });
//     }
// };

exports.parseResume = async (req, res) => {
    const { resume: resumeText, appliedJobTitle } = req.body;
    if (!resumeText) return res.status(400).json({ error: 'Resume text is required' });

    try {
        const generalPrompt = {
            model: 'gpt-3.5-turbo',
            temperature: 0,
            max_tokens: 800,
            messages: [
                {
                    role: 'user',
                    content: `Extract the following fields from the resume text:
    
    firstName, lastName, email, phoneNumber, linkedinProfile, location (with address, city, country, postcode), blog, portfolio, currentPosition, summary, skills (array), education (with degree, institution, from, to, city, region, description), certifications (with title, from, to, institution, description), projects (array with title, year, description), communication, leadership, references, awardsandAcknowledgements (array), interests (array)
    
    Return ONLY valid JSON in this format (exclude experience):
    
    {
      "firstName": "",
      "lastName": "",
      "email": "",
      "phoneNumber": "",
      "linkedinProfile": "",
      "location": {
        "address": "",
        "city": "",
        "country": "",
        "postcode": ""
      },
      "blog": "",
      "portfolio": "",
      "currentPosition": "",
      "summary": "",
      "skills": [],
      "education": [{
        "degree": "",
        "institution": "",
        "from": "",
        "to": "",
        "city": "",
        "region": "",
        "description": ""
      }],
      "certifications": [{
      title:"",
      from:"",
      to:"",
      institution:"", 
      description:""
      }],
      "projects": [{
        "title": "",
        "year": "",
        "description": ""
      }],
      "communication": "",
      "leadership": "",
      "references": "",
      "awardsandAcknowledgements": [],
      "interests": []
    }
    
    Resume Text:
    ${resumeText}`
                }
            ]
        };

        const experiencePrompt = {
            model: 'gpt-4o',
            temperature: 0,
            max_tokens: 2000,
            messages: [
                {
                    role: 'user',
                    content: `Extract detailed work experience from the resume below. For each job, include:
    
    - Start and end dates
    - Company name
    - Position title
    - Responsibilities (return as an array of bullet points, without bullet symbols or newline characters)
    
    Return a JSON object with the following format:
    
    {
      "experience": [
        {
          "from": "Start date",
          "to": "End date or Present",
          "companyName": "Company name",
          "position": "Job title",
          "responsibilities": ["Responsibility 1", "Responsibility 2", "Responsibility 3"]
        }
      ]
    }
    
    Only return valid JSON. Do not include explanations or markdown formatting.
    
    Resume Text:
    ${resumeText}`
                }
            ]
        };

        const headers = {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        // 🔁 Run both requests in parallel
        const [generalResponse, experienceResponse] = await Promise.all([
            axios.post('https://api.openai.com/v1/chat/completions', generalPrompt, headers),
            axios.post('https://api.openai.com/v1/chat/completions', experiencePrompt, headers)
        ]);

        const generalData = extractJSON(generalResponse.data.choices[0].message.content);
        const experienceData = extractJSON(experienceResponse.data.choices[0].message.content);

        const finalResult = {
            ...generalData,
            ...experienceData,
            appliedJobTitle: appliedJobTitle || ""
        };

        res.json(finalResult);

    } catch (error) {
        console.error('Error parsing resume:', error.message);
        res.status(500).json({ error: 'Failed to parse resume' });
    }
};
