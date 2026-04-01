import { Request, Response } from 'express';
import InterviewPrep from '../models/InterviewPrep.js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const generateQuestions = async (req: Request, res: Response) => {
  try {
    const { jobDescription, userBackground, applicationKitId } = req.body;
    const userId = req.user.id;

    const prompt = `Based on this job description: "${jobDescription}" and user background: "${userBackground}", generate 10 interview questions in these categories: behavioral (4), technical (4), situational (2). Return as JSON array with objects containing: question, category, difficulty.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    });

    const questions = JSON.parse(completion.choices[0].message.content);

    const interviewPrep = new InterviewPrep({
      userId,
      applicationKitId,
      jobDescription,
      questions: questions.map(q => ({
        ...q,
        userAnswer: '',
        starAnswer: '',
        feedback: ''
      })),
      progress: { completed: 0, total: questions.length },
      createdAt: new Date()
    });

    await interviewPrep.save();
    res.status(201).json({ data: interviewPrep });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate questions' });
  }
};

export const updateAnswer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { questionIndex, userAnswer } = req.body;
    const userId = req.user.id;

    const prep = await InterviewPrep.findOne({ _id: id, userId });
    if (!prep) {
      return res.status(404).json({ error: 'Interview prep not found' });
    }

    const question = prep.questions[questionIndex];
    const starPrompt = `Convert this answer to STAR format for the question "${question.question}": "${userAnswer}"`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: starPrompt }],
    });

    prep.questions[questionIndex].userAnswer = userAnswer;
    prep.questions[questionIndex].starAnswer = completion.choices[0].message.content;
    prep.progress.completed = prep.questions.filter(q => q.userAnswer).length;

    await prep.save();
    res.json({ data: prep });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update answer' });
  }
};

export const getFeedback = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { questionIndex } = req.body;
    const userId = req.user.id;

    const prep = await InterviewPrep.findOne({ _id: id, userId });
    if (!prep) {
      return res.status(404).json({ error: 'Interview prep not found' });
    }

    const question = prep.questions[questionIndex];
    const feedbackPrompt = `Provide constructive feedback on this interview answer. Question: "${question.question}" Answer: "${question.userAnswer}" Rate 1-5 and suggest improvements.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: feedbackPrompt }],
    });

    prep.questions[questionIndex].feedback = completion.choices[0].message.content;
    await prep.save();

    res.json({ data: prep });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate feedback' });
  }
};

export const getInterviewPrep = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const prep = await InterviewPrep.findOne({ _id: id, userId });
    if (!prep) {
      return res.status(404).json({ error: 'Interview prep not found' });
    }

    res.json({ data: prep });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch interview prep' });
  }
};

export const listInterviewPreps = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const preps = await InterviewPrep.find({ userId }).sort({ createdAt: -1 });
    res.json({ data: preps });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch interview preps' });
  }
};

export const exportStudyGuide = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const prep = await InterviewPrep.findOne({ _id: id, userId });
    if (!prep) {
      return res.status(404).json({ error: 'Interview prep not found' });
    }

    const studyGuide = {
      title: 'Interview Study Guide',
      questions: prep.questions.map(q => ({
        question: q.question,
        category: q.category,
        starAnswer: q.starAnswer || 'Not completed',
        feedback: q.feedback || 'No feedback yet'
      })),
      progress: prep.progress
    };

    res.json({ data: studyGuide });
  } catch (error) {
    res.status(500).json({ error: 'Failed to export study guide' });
  }
};