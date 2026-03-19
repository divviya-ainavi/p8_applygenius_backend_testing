import { Schema, model, Document } from 'mongoose';

interface IKeywordExtraction extends Document {
  userId: string;
  jobDescription: string;
  jobDescriptionHash: string;
  extractedKeywords: {
    requiredSkills: Array<{
      keyword: string;
      confidence: number;
      category: string;
    }>;
    preferredSkills: Array<{
      keyword: string;
      confidence: number;
      category: string;
    }>;
    technologies: Array<{
      keyword: string;
      confidence: number;
      category: string;
    }>;
    certifications: Array<{
      keyword: string;
      confidence: number;
      category: string;
    }>;
    softSkills: Array<{
      keyword: string;
      confidence: number;
      category: string;
    }>;
  };
  userModifications: {
    addedKeywords: Array<{
      keyword: string;
      category: string;
      addedAt: Date;
    }>;
    removedKeywords: Array<{
      keyword: string;
      category: string;
      removedAt: Date;
    }>;
    modifiedKeywords: Array<{
      original: string;
      modified: string;
      category: string;
      modifiedAt: Date;
    }>;
  };
  finalKeywords: {
    requiredSkills: string[];
    preferredSkills: string[];
    technologies: string[];
    certifications: string[];
    softSkills: string[];
  };
  extractionMetadata: {
    aiModel: string;
    extractionVersion: string;
    processingTime: number;
    totalKeywordsFound: number;
    confidence: number;
  };
  usageStats: {
    timesUsed: number;
    lastUsed: Date;
    resumesGenerated: number;
  };
  preferences: {
    autoApprove: boolean;
    preferredCategories: string[];
    excludePatterns: string[];
    customWeights: Map<string, number>;
  };
  isActive: boolean;
}

const keywordExtractionSchema = new Schema<IKeywordExtraction>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  jobDescription: {
    type: String,
    required: true
  },
  jobDescriptionHash: {
    type: String,
    required: true,
    index: true
  },
  extractedKeywords: {
    requiredSkills: [{
      keyword: { type: String, required: true },
      confidence: { type: Number, min: 0, max: 1, required: true },
      category: { type: String, required: true }
    }],
    preferredSkills: [{
      keyword: { type: String, required: true },
      confidence: { type: Number, min: 0, max: 1, required: true },
      category: { type: String, required: true }
    }],
    technologies: [{
      keyword: { type: String, required: true },
      confidence: { type: Number, min: 0, max: 1, required: true },
      category: { type: String, required: true }
    }],
    certifications: [{
      keyword: { type: String, required: true },
      confidence: { type: Number, min: 0, max: 1, required: true },
      category: { type: String, required: true }
    }],
    softSkills: [{
      keyword: { type: String, required: true },
      confidence: { type: Number, min: 0, max: 1, required: true },
      category: { type: String, required: true }
    }]
  },
  userModifications: {
    addedKeywords: [{
      keyword: { type: String, required: true },
      category: { type: String, required: true },
      addedAt: { type: Date, default: Date.now }
    }],
    removedKeywords: [{
      keyword: { type: String, required: true },
      category: { type: String, required: true },
      removedAt: { type: Date, default: Date.now }
    }],
    modifiedKeywords: [{
      original: { type: String, required: true },
      modified: { type: String, required: true },
      category: { type: String, required: true },
      modifiedAt: { type: Date, default: Date.now }
    }]
  },
  finalKeywords: {
    requiredSkills: [{ type: String }],
    preferredSkills: [{ type: String }],
    technologies: [{ type: String }],
    certifications: [{ type: String }],
    softSkills: [{ type: String }]
  },
  extractionMetadata: {
    aiModel: { type: String, required: true },
    extractionVersion: { type: String, required: true },
    processingTime: { type: Number, required: true },
    totalKeywordsFound: { type: Number, required: true, min: 0 },
    confidence: { type: Number, min: 0, max: 1, required: true }
  },
  usageStats: {
    timesUsed: { type: Number, default: 0, min: 0 },
    lastUsed: { type: Date, default: Date.now },
    resumesGenerated: { type: Number, default: 0, min: 0 }
  },
  preferences: {
    autoApprove: { type: Boolean, default: false },
    preferredCategories: [{ type: String }],
    excludePatterns: [{ type: String }],
    customWeights: {
      type: Map,
      of: Number,
      default: new Map()
    }
  },
  isActive: { type: Boolean, default: true }
}, { 
  timestamps: true,
  collection: 'keywordextractions'
});

// Compound indexes for efficient queries
keywordExtractionSchema.index({ userId: 1, jobDescriptionHash: 1 }, { unique: true });
keywordExtractionSchema.index({ userId: 1, createdAt: -1 });
keywordExtractionSchema.index({ jobDescriptionHash: 1 });

// Instance methods
keywordExtractionSchema.methods.incrementUsage = function() {
  this.usageStats.timesUsed += 1;
  this.usageStats.lastUsed = new Date();
  return this.save();
};

keywordExtractionSchema.methods.addResumeGenerated = function() {
  this.usageStats.resumesGenerated += 1;
  return this.incrementUsage();
};

keywordExtractionSchema.methods.getAllKeywords = function() {
  return [
    ...this.finalKeywords.requiredSkills,
    ...this.finalKeywords.preferredSkills,
    ...this.finalKeywords.technologies,
    ...this.finalKeywords.certifications,
    ...this.finalKeywords.softSkills
  ];
};

// Static methods
keywordExtractionSchema.statics.findByUserAndHash = function(userId: string, hash: string) {
  return this.findOne({ userId, jobDescriptionHash: hash, isActive: true });
};

keywordExtractionSchema.statics.getUserExtractions = function(userId: string, limit = 20) {
  return this.find({ userId, isActive: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-jobDescription -extractedKeywords');
};

keywordExtractionSchema.statics.getPopularKeywords = function(category?: string) {
  const pipeline: any[] = [
    { $match: { isActive: true } },
    { $unwind: '$finalKeywords.requiredSkills' },
    { $group: { _id: '$finalKeywords.requiredSkills', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 50 }
  ];

  if (category) {
    pipeline[1] = { $unwind: `$finalKeywords.${category}` };
    pipeline[2] = { $group: { _id: `$finalKeywords.${category}`, count: { $sum: 1 } } };
  }

  return this.aggregate(pipeline);
};

export const KeywordExtraction = model<IKeywordExtraction>('KeywordExtraction', keywordExtractionSchema);